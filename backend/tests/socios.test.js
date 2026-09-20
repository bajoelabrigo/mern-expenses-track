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
const { setPaypal, applyRefund, captureIdFromRefund } = require("../services/paypal");
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
  const state = { orders: [], captured: [], configured: true, firmaValida: true, falla: false };
  let n = 0;
  state.impl = {
    isConfigured: () => state.configured,
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
    verifyWebhook: async () => state.firmaValida,
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
  });

  test("sin sesión no se puede aportar ni ver lo aportado", async () => {
    await request(app).get("/api/v1/socio/estado").expect(401);
    await request(app).post("/api/v1/socio/orden").send({ amount: 10 }).expect(401);
  });
});
