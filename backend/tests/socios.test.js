const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  app,
  request,
  setupDatabase,
  teardownDatabase,
  clearDatabase,
  createUser,
} = require("./helpers");
const { setPaypal, applyRefund, captureIdFromRefund, readRefund } = require("../services/paypal");
const Support = require("../model/Support");

const as = (method, url, user) =>
  request(app)[method](url).set("Authorization", `Bearer ${user.token}`);

//! Una captura como la que devuelve PayPal (misma forma en la respuesta
//! directa y en el aviso)
const capture = ({ orderId, captureId = "CAP-1", value = "10.00", fee = "0.79", reference }) => ({
  id: captureId,
  custom_id: String(reference || ""),
  amount: { value, currency_code: "USD" },
  seller_receivable_breakdown: { paypal_fee: { value: fee } },
  supplementary_data: { related_ids: { order_id: orderId } },
});

//! PayPal falso: registra lo que se le pide, sin salir a internet
const fakePaypal = () => {
  const state = {
    orders: [],
    captured: [],
    subs: [],
    canceladas: [],
    configured: true,
    firmaValida: true,
    firmasComprobadas: 0,
    falla: false,
  };
  let n = 0;
  state.impl = {
    isConfigured: () => state.configured,
    createSubscription: async ({ planId, reference }) => {
      if (state.falla) throw new Error("PayPal caído");
      n += 1;
      const subscriptionId = `I-SUB${n}`;
      state.subs.push({ subscriptionId, planId, reference: String(reference) });
      return { subscriptionId, approvalUrl: `https://paypal.test/aprobar/${subscriptionId}` };
    },
    cancelSubscription: async (id) => {
      if (state.falla) throw new Error("PayPal caído");
      state.canceladas.push(id);
      return null;
    },
    createOrder: async ({ amount, currency, reference }) => {
      if (state.falla) throw new Error("PayPal caído");
      n += 1;
      const orderId = `ORDER-${n}`;
      state.orders.push({ orderId, amount, currency, reference: String(reference) });
      return { orderId };
    },
    captureOrder: async (orderId) => {
      state.captured.push(orderId);
      const pedida = state.orders.find((o) => o.orderId === orderId);
      return {
        purchase_units: [
          {
            payments: {
              captures: [
                capture({ orderId, value: pedida?.amount || "10.00", reference: pedida?.reference }),
              ],
            },
          },
        ],
      };
    },
    //! Se cuentan las comprobaciones: cada una cuesta un viaje a PayPal en
    //! producción, y la prueba de abajo vigila que no se gasten de más
    verifyWebhook: async () => {
      state.firmasComprobadas += 1;
      return state.firmaValida;
    },
  };
  return state;
};

describe("Socios de la app", () => {
  let pp;

  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(async () => {
    pp = fakePaypal();
    setPaypal(pp.impl);
    await clearDatabase();
  });

  test("sin claves de PayPal la sección se anuncia como no disponible", async () => {
    const user = await createUser();
    pp.configured = false;

    const estado = await as("get", "/api/v1/socio/estado", user).expect(200);
    assert.equal(estado.body.disponible, false);

    await as("post", "/api/v1/socio/orden", user).send({ amount: 10 }).expect(503);
  });

  test("aportar guarda el aporte, cobra y da las gracias con el monto real", async () => {
    const user = await createUser();

    const orden = await as("post", "/api/v1/socio/orden", user).send({ amount: 10 }).expect(201);
    assert.equal(orden.body.orderId, "ORDER-1");
    //! El monto va a PayPal con dos decimales
    assert.equal(pp.orders[0].amount, "10.00");
    assert.equal(pp.orders[0].currency, "USD");

    //! Mientras no se cobre, queda pendiente y no cuenta
    let guardado = await Support.findOne({ paypalOrderId: "ORDER-1" });
    assert.equal(guardado.status, "pendiente");
    assert.equal((await as("get", "/api/v1/socio/estado", user).expect(200)).body.total, 0);

    const cobro = await as("post", "/api/v1/socio/capturar", user)
      .send({ orderId: "ORDER-1" })
      .expect(200);
    assert.equal(cobro.body.amount, 10);

    guardado = await Support.findOne({ paypalOrderId: "ORDER-1" });
    assert.equal(guardado.status, "pagado");
    assert.equal(guardado.paypalCaptureId, "CAP-1");
    //! La comisión de PayPal se guarda: el ingreso real es 10 − 0.79
    assert.equal(guardado.feeCents, 79);

    const estado = await as("get", "/api/v1/socio/estado", user).expect(200);
    assert.equal(estado.body.total, 10);
    assert.equal(estado.body.aportes.length, 1);
  });

  test("los montos imposibles se rechazan y no se llama a PayPal", async () => {
    const user = await createUser();

    for (const amount of [0, -5, 0.5, 999999, "hola", null]) {
      await as("post", "/api/v1/socio/orden", user).send({ amount }).expect(400);
    }
    assert.equal(pp.orders.length, 0);
    assert.equal(await Support.countDocuments(), 0, "no queda ninguna fila a medias");
  });

  test("si PayPal falla al abrir la orden no queda un aporte huérfano", async () => {
    const user = await createUser();
    pp.falla = true;

    await as("post", "/api/v1/socio/orden", user).send({ amount: 10 }).expect(502);
    assert.equal(await Support.countDocuments(), 0);
  });

  test("el aporte de otro no se puede cobrar, y cobrarlo dos veces no lo duplica", async () => {
    const dueño = await createUser();
    const otro = await createUser();

    await as("post", "/api/v1/socio/orden", dueño).send({ amount: 20 }).expect(201);

    await as("post", "/api/v1/socio/capturar", otro).send({ orderId: "ORDER-1" }).expect(403);
    await as("post", "/api/v1/socio/capturar", dueño).send({ orderId: "no-existe" }).expect(404);

    await as("post", "/api/v1/socio/capturar", dueño).send({ orderId: "ORDER-1" }).expect(200);
    //! La segunda vez no vuelve a cobrar en PayPal
    await as("post", "/api/v1/socio/capturar", dueño).send({ orderId: "ORDER-1" }).expect(200);
    assert.equal(pp.captured.length, 1);

    assert.equal(await Support.countDocuments({ status: "pagado" }), 1);
    assert.equal((await as("get", "/api/v1/socio/estado", dueño).expect(200)).body.total, 20);
  });

  test("un aviso sin firma válida no toca nada", async () => {
    const user = await createUser();
    await as("post", "/api/v1/socio/orden", user).send({ amount: 10 }).expect(201);
    pp.firmaValida = false;

    await request(app)
      .post("/api/v1/socio/webhook")
      .send({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: capture({ orderId: "ORDER-1" }) })
      .expect(400);

    assert.equal((await Support.findOne({ paypalOrderId: "ORDER-1" })).status, "pendiente");
  });

  test("el aviso de PayPal confirma el aporte aunque la página no lo haya hecho", async () => {
    const user = await createUser();
    await as("post", "/api/v1/socio/orden", user).send({ amount: 15 }).expect(201);

    //! Llega el aviso sin que nadie haya llamado a capturar
    await request(app)
      .post("/api/v1/socio/webhook")
      .send({
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: capture({ orderId: "ORDER-1", value: "15.00" }),
      })
      .expect(200);

    const guardado = await Support.findOne({ paypalOrderId: "ORDER-1" });
    assert.equal(guardado.status, "pagado");

    //! Y si PayPal lo reenvía (lo hace), no se cuenta dos veces
    await request(app)
      .post("/api/v1/socio/webhook")
      .send({
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: capture({ orderId: "ORDER-1", value: "15.00" }),
      })
      .expect(200);
    assert.equal(await Support.countDocuments(), 1);
    assert.equal((await as("get", "/api/v1/socio/estado", user).expect(200)).body.total, 15);
  });

  test("un reembolso deja de contar como aporte", async () => {
    const user = await createUser();
    await as("post", "/api/v1/socio/orden", user).send({ amount: 30 }).expect(201);
    await as("post", "/api/v1/socio/capturar", user).send({ orderId: "ORDER-1" }).expect(200);

    const refund = (value) => ({
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource: {
        amount: { value, currency_code: "USD" },
        links: [{ rel: "up", href: "https://api.paypal.com/v2/payments/captures/CAP-1" }],
      },
    });

    //! Primero devuelven la mitad: sigue siendo un aporte, de menos
    await request(app).post("/api/v1/socio/webhook").send(refund("10.00")).expect(200);
    let guardado = await Support.findOne({ paypalCaptureId: "CAP-1" });
    assert.equal(guardado.status, "pagado");
    assert.equal(guardado.refundedCents, 1000);
    assert.equal((await as("get", "/api/v1/socio/estado", user).expect(200)).body.total, 20);

    //! Y luego el resto: ya no cuenta
    await request(app).post("/api/v1/socio/webhook").send(refund("20.00")).expect(200);
    guardado = await Support.findOne({ paypalCaptureId: "CAP-1" });
    assert.equal(guardado.status, "devuelto");
    assert.equal((await as("get", "/api/v1/socio/estado", user).expect(200)).body.total, 0);
  });

  test("las cuentas de un reembolso: parciales, repetidos y de más", () => {
    //! Un reembolso parcial
    assert.deepEqual(applyRefund(3000, 0, 1000), { refundedCents: 1000, fullyRefunded: false });
    //! Otro parcial encima: completan el total
    assert.deepEqual(applyRefund(3000, 1000, 2000), { refundedCents: 3000, fullyRefunded: true });
    //! Nunca se devuelve más de lo que se dio, aunque el aviso llegue repetido
    assert.deepEqual(applyRefund(3000, 3000, 3000), { refundedCents: 3000, fullyRefunded: true });

    //! El id de la captura sale del enlace "up" si no viene aparte
    assert.equal(
      captureIdFromRefund({ links: [{ rel: "up", href: "https://x/v2/payments/captures/CAP-9" }] }),
      "CAP-9"
    );

    //! Y del reembolso se leen los dos ids, más el importe
    assert.deepEqual(
      readRefund({
        id: "REF-1",
        amount: { value: "10.00" },
        supplementary_data: { related_ids: { capture_id: "CAP-9", order_id: "ORDER-9" } },
      }),
      { refundId: "REF-1", captureId: "CAP-9", orderId: "ORDER-9", refundedCents: 1000 }
    );

    //! Un importe ilegible no se convierte en NaN
    assert.equal(readRefund({ amount: { value: "hola" } }).refundedCents, 0);
  });

  test("un reembolso encuentra su aporte por el id de la orden", async () => {
    const user = await createUser();
    await as("post", "/api/v1/socio/orden", user).send({ amount: 30 }).expect(201);
    await as("post", "/api/v1/socio/capturar", user).send({ orderId: "ORDER-1" }).expect(200);

    //! Se simula el caso que importa: el aporte se cobró, pero su id de captura
    //! no quedó guardado (el aviso se adelantó a `markPaid`). Antes esto dejaba
    //! el reembolso sin dueño y contando como aporte para siempre.
    await Support.updateOne({ paypalOrderId: "ORDER-1" }, { $unset: { paypalCaptureId: "" } });

    await request(app)
      .post("/api/v1/socio/webhook")
      .send({
        event_type: "PAYMENT.CAPTURE.REFUNDED",
        resource: {
          amount: { value: "30.00", currency_code: "USD" },
          supplementary_data: { related_ids: { order_id: "ORDER-1" } },
        },
      })
      .expect(200);

    const guardado = await Support.findOne({ paypalOrderId: "ORDER-1" });
    assert.equal(guardado.status, "devuelto");
    assert.equal(guardado.refundedCents, 3000);
    assert.equal((await as("get", "/api/v1/socio/estado", user).expect(200)).body.total, 0);
  });

  test("el reembolso de otro producto se ignora sin gritar; uno sin ids sí grita", async () => {
    const gritos = [];
    const original = console.error;
    console.error = (...args) => gritos.push(args.join(" "));

    try {
      //! La app de PayPal se comparte con chat-app y holy_app, y sus avisos
      //! llegan aquí igual: los eventos son de la cuenta, no de la app
      await request(app)
        .post("/api/v1/socio/webhook")
        .send({
          event_type: "PAYMENT.CAPTURE.REFUNDED",
          resource: {
            amount: { value: "5.00", currency_code: "USD" },
            supplementary_data: { related_ids: { capture_id: "CAP-DE-OTRO", order_id: "ORD-OTRO" } },
          },
        })
        .expect(200);

      assert.deepEqual(gritos, [], "un reembolso ajeno no es una falsa alarma");

      //! Pero sin ningún id no hay forma de saber si era nuestro
      await request(app)
        .post("/api/v1/socio/webhook")
        .send({
          event_type: "PAYMENT.CAPTURE.REVERSED",
          resource: { id: "REF-SIN-IDS", amount: { value: "5.00", currency_code: "USD" } },
        })
        .expect(200);

      assert.equal(gritos.length, 1, "esto sí puede ser dinero que salió sin enterarnos");
      assert.match(gritos[0], /REF-SIN-IDS/);
    } finally {
      console.error = original;
    }
  });

  //! ── Aporte mensual ──────────────────────────────────────────────────────

  //! Un cobro de suscripción, con los nombres del formato antiguo de pagos:
  //! el importe en `amount.total` y nuestra referencia en `custom`
  const venta = ({ saleId, subscriptionId, total = "10.00", fee = "0.79" }) => ({
    event_type: "PAYMENT.SALE.COMPLETED",
    resource: {
      id: saleId,
      billing_agreement_id: subscriptionId,
      amount: { total, currency: "USD" },
      transaction_fee: { value: fee, currency_code: "USD" },
      create_time: "2026-09-30T12:00:00Z",
    },
  });

  test("el aporte mensual se abre y devuelve a donde aprobarlo", async () => {
    const user = await createUser();

    const r = await as("post", "/api/v1/socio/suscripcion", user).send({ amount: 10 }).expect(201);
    assert.match(r.body.approvalUrl, /paypal\.test\/aprobar\/I-SUB1/);

    //! Se le pasa a PayPal el plan del monto pedido y una referencia nuestra
    assert.equal(pp.subs[0].planId, "P-PRUEBA-10");
    assert.ok(pp.subs[0].reference, "viaja una referencia para reconocer los cobros");

    //! Todavía no ha pagado nadie: queda pendiente y no cuenta como aporte
    const estado = await as("get", "/api/v1/socio/estado", user).expect(200);
    assert.equal(estado.body.suscripcion, null, "pendiente no se enseña como activa");
    assert.equal(estado.body.total, 0);
    assert.deepEqual(estado.body.planes, [5, 10, 20]);
  });

  test("los montos sin plan se rechazan", async () => {
    const user = await createUser();
    for (const amount of [7, 0, 50, "hola", null]) {
      await as("post", "/api/v1/socio/suscripcion", user).send({ amount }).expect(503);
    }
    assert.equal(pp.subs.length, 0, "no se llama a PayPal por un monto que no existe");
  });

  test("cada cobro mensual queda como un aporte, y el aviso repetido no lo duplica", async () => {
    const user = await createUser();
    await as("post", "/api/v1/socio/suscripcion", user).send({ amount: 10 }).expect(201);

    //! Se activa y entra el primer cobro
    await request(app)
      .post("/api/v1/socio/webhook")
      .send({ event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-SUB1" } })
      .expect(200);
    await request(app)
      .post("/api/v1/socio/webhook")
      .send(venta({ saleId: "SALE-1", subscriptionId: "I-SUB1" }))
      .expect(200);

    let estado = await as("get", "/api/v1/socio/estado", user).expect(200);
    assert.equal(estado.body.total, 10);
    assert.equal(estado.body.suscripcion.status, "activa");

    //! PayPal reenvía los avisos: el mismo cobro no puede contar dos veces
    await request(app)
      .post("/api/v1/socio/webhook")
      .send(venta({ saleId: "SALE-1", subscriptionId: "I-SUB1" }))
      .expect(200);
    estado = await as("get", "/api/v1/socio/estado", user).expect(200);
    assert.equal(estado.body.total, 10, "el aviso repetido no suma otra vez");

    //! Al mes siguiente, otro cobro: ese sí suma
    await request(app)
      .post("/api/v1/socio/webhook")
      .send(venta({ saleId: "SALE-2", subscriptionId: "I-SUB1" }))
      .expect(200);
    estado = await as("get", "/api/v1/socio/estado", user).expect(200);
    assert.equal(estado.body.total, 20);
    assert.equal(await Support.countDocuments({ paypalSaleId: { $ne: null } }), 2);
  });

  test("no se puede tener dos aportes mensuales a la vez", async () => {
    const user = await createUser();
    await as("post", "/api/v1/socio/suscripcion", user).send({ amount: 5 }).expect(201);
    await request(app)
      .post("/api/v1/socio/webhook")
      .send({ event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-SUB1" } })
      .expect(200);

    await as("post", "/api/v1/socio/suscripcion", user).send({ amount: 20 }).expect(409);
  });

  test("cancelar deja de cobrar pero no borra lo ya aportado", async () => {
    const user = await createUser();
    await as("post", "/api/v1/socio/suscripcion", user).send({ amount: 10 }).expect(201);
    await request(app)
      .post("/api/v1/socio/webhook")
      .send(venta({ saleId: "SALE-1", subscriptionId: "I-SUB1" }))
      .expect(200);

    await as("delete", "/api/v1/socio/suscripcion", user).expect(200);
    assert.deepEqual(pp.canceladas, ["I-SUB1"], "se le pide a PayPal que pare");

    const estado = await as("get", "/api/v1/socio/estado", user).expect(200);
    assert.equal(estado.body.suscripcion, null, "ya no hay compromiso vivo");
    assert.equal(estado.body.total, 10, "lo aportado sigue contando");

    //! Y un aviso de activación rezagado no la resucita
    await request(app)
      .post("/api/v1/socio/webhook")
      .send({ event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-SUB1" } })
      .expect(200);
    const despues = await as("get", "/api/v1/socio/estado", user).expect(200);
    assert.equal(despues.body.suscripcion, null);

    //! Sin suscripción viva, cancelar otra vez no encuentra nada
    await as("delete", "/api/v1/socio/suscripcion", user).expect(404);
  });

  test("una suscripción suspendida sigue siendo suya, y un cobro la revive", async () => {
    const user = await createUser();
    await as("post", "/api/v1/socio/suscripcion", user).send({ amount: 5 }).expect(201);

    await request(app)
      .post("/api/v1/socio/webhook")
      .send({ event_type: "BILLING.SUBSCRIPTION.SUSPENDED", resource: { id: "I-SUB1" } })
      .expect(200);
    let estado = await as("get", "/api/v1/socio/estado", user).expect(200);
    assert.equal(estado.body.suscripcion.status, "suspendida", "se sigue viendo, para poder actuar");

    //! PayPal cobra sin avisar de que la reactivó: que entre dinero es la prueba
    await request(app)
      .post("/api/v1/socio/webhook")
      .send(venta({ saleId: "SALE-9", subscriptionId: "I-SUB1", total: "5.00" }))
      .expect(200);
    estado = await as("get", "/api/v1/socio/estado", user).expect(200);
    assert.equal(estado.body.suscripcion.status, "activa");
  });

  test("los cobros y avisos de otro producto se ignoran", async () => {
    const user = await createUser();
    await as("post", "/api/v1/socio/suscripcion", user).send({ amount: 10 }).expect(201);

    //! La app de PayPal se comparte con chat-app y holy_app
    await request(app)
      .post("/api/v1/socio/webhook")
      .send(venta({ saleId: "SALE-AJENA", subscriptionId: "I-DE-OTRO" }))
      .expect(200);
    await request(app)
      .post("/api/v1/socio/webhook")
      .send({ event_type: "BILLING.SUBSCRIPTION.CANCELLED", resource: { id: "I-DE-OTRO" } })
      .expect(200);

    assert.equal(await Support.countDocuments(), 0, "no se guarda el cobro de otro");
    const estado = await as("get", "/api/v1/socio/estado", user).expect(200);
    assert.equal(estado.body.total, 0);
  });

  test("el reembolso de un cobro mensual deja de contar", async () => {
    const user = await createUser();
    await as("post", "/api/v1/socio/suscripcion", user).send({ amount: 10 }).expect(201);
    await request(app)
      .post("/api/v1/socio/webhook")
      .send(venta({ saleId: "SALE-1", subscriptionId: "I-SUB1" }))
      .expect(200);

    //! El reembolso de una venta apunta a su cobro con sale_id, directo
    await request(app)
      .post("/api/v1/socio/webhook")
      .send({
        event_type: "PAYMENT.SALE.REFUNDED",
        resource: { id: "REF-1", sale_id: "SALE-1", amount: { total: "10.00" } },
      })
      .expect(200);

    const estado = await as("get", "/api/v1/socio/estado", user).expect(200);
    assert.equal(estado.body.total, 0);
    const aporte = await Support.findOne({ paypalSaleId: "SALE-1" });
    assert.equal(aporte.status, "devuelto");
  });

  test("un aviso que no nos toca no gasta una comprobación de firma", async () => {
    //! El webhook está suscrito a "*" y la app de PayPal se comparte con
    //! chat-app y holy_app: llega mucho que no es nuestro. Comprobar la firma
    //! cuesta un viaje a PayPal (~120 ms), así que primero se mira el tipo.
    const ajenos = [
      "BILLING.SUBSCRIPTION.CREATED",
      "CHECKOUT.ORDER.APPROVED",
      "PAYMENT.PAYOUTSBATCH.SUCCESS",
      "VAULT.CREDIT-CARD.CREATED",
    ];
    for (const event_type of ajenos) {
      await request(app).post("/api/v1/socio/webhook").send({ event_type }).expect(200);
    }
    assert.equal(pp.firmasComprobadas, 0, "ni un solo viaje a PayPal por avisos ajenos");

    //! Pero lo que sí nos toca sigue pasando por la firma, igual que antes: la
    //! defensa no se relaja, solo se deja de pagar por rechazar lo que se iba
    //! a ignorar de todas formas.
    pp.firmaValida = false;
    await request(app)
      .post("/api/v1/socio/webhook")
      .send({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: {} })
      .expect(400);
    assert.equal(pp.firmasComprobadas, 1);
  });

  test("sin sesión no se puede aportar ni ver lo aportado", async () => {
    await request(app).get("/api/v1/socio/estado").expect(401);
    await request(app).post("/api/v1/socio/orden").send({ amount: 10 }).expect(401);
  });
});
