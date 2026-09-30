const asyncHandler = require("express-async-handler");
const Support = require("../model/Support");
const Subscription = require("../model/Subscription");
const { toCents, fromCents } = require("../utils/money");
const {
  paypal,
  readCapture,
  captureFromOrder,
  readRefund,
  applyRefund,
  readSale,
  saleIdFromRefund,
} = require("../services/paypal");
const {
  APP_URL,
  PAYPAL_PLAN_SOCIO_5,
  PAYPAL_PLAN_SOCIO_10,
  PAYPAL_PLAN_SOCIO_20,
} = require("../config/env");

//! Los montos del aporte mensual son los tres que existen como plan en PayPal:
//! un plan fija su precio al crearse, así que aquí no se puede elegir cualquier
//! cifra como en el aporte de una vez.
const PLANES = {
  5: PAYPAL_PLAN_SOCIO_5,
  10: PAYPAL_PLAN_SOCIO_10,
  20: PAYPAL_PLAN_SOCIO_20,
};

const planesDisponibles = () =>
  Object.entries(PLANES)
    .filter(([, id]) => Boolean(id))
    .map(([monto]) => Number(monto));

//! Tope por aporte. No es un pago por un servicio, es un apoyo voluntario:
//! un importe enorme casi siempre es un dedo de más.
const MIN_CENTS = 100;
const MAX_CENTS = 100000;

const parseAmount = (value) => {
  const cents = toCents(value);
  if (cents === null || cents < MIN_CENTS || cents > MAX_CENTS) return null;
  return cents;
};

//! Guarda el pago y devuelve el aporte ya actualizado. La usan la captura
//! directa y el aviso de PayPal: si llegan los dos (pasa), el segundo no
//! duplica nada porque busca por el id de la orden.
const markPaid = async (capture) => {
  const { captureId, orderId, amountCents, feeCents, currency } = readCapture(capture);
  if (!orderId) return null;

  return Support.findOneAndUpdate(
    { paypalOrderId: orderId },
    {
      $set: {
        status: "pagado",
        paypalCaptureId: captureId,
        amountCents,
        feeCents,
        currency,
        paidAt: new Date(),
      },
    },
    { new: true }
  );
};

//! Guarda UN cobro mensual. A diferencia de chat-app, al activarse la
//! suscripción no se crea ninguna fila de aporte: todos los cobros, incluido el
//! primero, entran por aquí. Así no hay que "reclamar" después la fila del mes
//! 1, que es de donde a ellos les salían ingresos duplicados.
//!
//! Es idempotente por el id de la venta: PayPal reenvía los avisos, y un upsert
//! sobre un campo único no deja que el mismo cobro se guarde dos veces.
const markSalePaid = async (sale) => {
  const { saleId, subscriptionId, amountCents, feeCents, paidAt } = readSale(sale);
  if (!saleId || !subscriptionId) return null;

  //! Si no es una suscripción nuestra, es de otro producto que comparte la app
  //! de PayPal (chat-app, holy_app): sus avisos llegan aquí igual
  const suscripcion = await Subscription.findOne({ paypalSubscriptionId: subscriptionId });
  if (!suscripcion) return null;

  const aporte = await Support.findOneAndUpdate(
    { paypalSaleId: saleId },
    {
      $set: { status: "pagado", amountCents, feeCents, paidAt },
      $setOnInsert: {
        user: suscripcion.user,
        email: suscripcion.email,
        subscription: suscripcion._id,
        currency: suscripcion.currency,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  //! Que entre dinero es la prueba de que la suscripción vive: si estaba
  //! suspendida por un cobro fallido y la tarjeta vuelve a funcionar, PayPal
  //! cobra sin avisar de que la reactivó.
  if (suscripcion.status !== "cancelada") suscripcion.status = "activa";
  suscripcion.lastPaymentAt = paidAt;
  if (!suscripcion.activatedAt) suscripcion.activatedAt = paidAt;
  await suscripcion.save();

  return aporte;
};

const supportController = {
  //! Si se puede aportar ahora mismo. La página lo consulta antes de pintar
  //! nada: sin claves de PayPal no tiene sentido ofrecer el botón.
  status: asyncHandler(async (req, res) => {
    const disponible = paypal.isConfigured();
    const mios = req.user
      ? await Support.find({ user: req.user._id, status: "pagado" }).sort({ paidAt: -1 }).limit(10)
      : [];

    //! La suscripción que cuenta es la que está viva. Las "pendiente" se
    //! acumulan solas: mucha gente abre el pago en PayPal y no lo termina.
    const suscripcion = req.user
      ? await Subscription.findOne({
          user: req.user._id,
          status: { $in: ["activa", "suspendida"] },
        }).sort({ createdAt: -1 })
      : null;

    res.json({
      disponible,
      //! Lo que ha aportado esta persona, para darle las gracias
      total: fromCents(mios.reduce((suma, s) => suma + s.amountCents - s.refundedCents, 0)),
      aportes: mios.map((s) => ({ amount: s.amount, currency: s.currency, paidAt: s.paidAt })),
      //! Los montos con plan en PayPal; vacío si no se configuraron, y entonces
      //! la página solo ofrece el aporte de una vez
      planes: disponible ? planesDisponibles() : [],
      suscripcion: suscripcion || null,
    });
  }),

  //! Abre una orden de PayPal y la guarda como pendiente
  createOrder: asyncHandler(async (req, res) => {
    if (!paypal.isConfigured()) {
      return res.status(503).json({ message: "Los aportes no están disponibles ahora mismo" });
    }

    const cents = parseAmount(req.body?.amount);
    if (cents === null) {
      return res.status(400).json({
        message: `El aporte debe estar entre ${fromCents(MIN_CENTS)} y ${fromCents(MAX_CENTS)} dólares`,
      });
    }

    //! Primero la fila, para tener una referencia que viaje con la orden
    const support = await Support.create({
      user: req.user._id,
      email: req.user.email,
      amountCents: cents,
      currency: "USD",
    });

    let orderId;
    try {
      ({ orderId } = await paypal.createOrder({
        amount: fromCents(cents).toFixed(2),
        currency: "USD",
        reference: support._id,
      }));
    } catch {
      await Support.deleteOne({ _id: support._id });
      return res.status(502).json({ message: "PayPal no respondió. Inténtalo de nuevo." });
    }

    support.paypalOrderId = orderId;
    await support.save();

    res.status(201).json({ orderId });
  }),

  //! Abre el compromiso mensual y devuelve a dónde mandar a la persona para
  //! que lo apruebe en PayPal. Aquí todavía no se ha cobrado nada.
  crearSuscripcion: asyncHandler(async (req, res) => {
    const monto = Number(req.body?.amount);
    const planId = PLANES[monto];
    if (!paypal.isConfigured() || !planId) {
      return res.status(503).json({ message: "El aporte mensual no está disponible ahora mismo" });
    }

    //! Dos suscripciones a la vez serían dos cobros al mes sin que la persona
    //! lo pretendiera
    const yaTiene = await Subscription.findOne({
      user: req.user._id,
      status: { $in: ["activa", "suspendida"] },
    });
    if (yaTiene) {
      return res.status(409).json({ message: "Ya tienes un aporte mensual; cancélalo primero" });
    }

    //! Primero la fila, para tener una referencia que viaje con la suscripción
    //! y vuelva en cada cobro mensual
    const suscripcion = await Subscription.create({
      user: req.user._id,
      email: req.user.email,
      planId,
      amountCents: toCents(monto),
      currency: "USD",
    });

    let creada;
    try {
      creada = await paypal.createSubscription({
        planId,
        reference: suscripcion._id,
        returnUrl: `${APP_URL}/socio?mensual=listo`,
        cancelUrl: `${APP_URL}/socio?mensual=cancelado`,
      });
    } catch {
      await Subscription.deleteOne({ _id: suscripcion._id });
      return res.status(502).json({ message: "PayPal no respondió. Inténtalo de nuevo." });
    }

    suscripcion.paypalSubscriptionId = creada.subscriptionId;
    await suscripcion.save();

    res.status(201).json({ approvalUrl: creada.approvalUrl });
  }),

  //! Cancelar deja de cobrar en adelante; lo ya aportado no se devuelve ni se
  //! borra, que para eso son filas aparte.
  cancelarSuscripcion: asyncHandler(async (req, res) => {
    const suscripcion = await Subscription.findOne({
      user: req.user._id,
      status: { $in: ["activa", "suspendida"] },
    });
    if (!suscripcion) {
      return res.status(404).json({ message: "No tienes ningún aporte mensual activo" });
    }

    try {
      await paypal.cancelSubscription(suscripcion.paypalSubscriptionId);
    } catch {
      return res.status(502).json({ message: "PayPal no pudo cancelarlo. Inténtalo de nuevo." });
    }

    //! No se espera al aviso de PayPal: la persona acaba de pedirlo y tiene que
    //! verlo cancelado al momento. El aviso llegará y dejará lo mismo.
    suscripcion.status = "cancelada";
    suscripcion.cancelledAt = new Date();
    await suscripcion.save();

    res.json({ ok: true });
  }),

  //! El botón de la página avisa en cuanto el usuario aprueba el pago. El
  //! aviso de PayPal llegará también, pero puede tardar: así la página puede
  //! dar las gracias al momento.
  capture: asyncHandler(async (req, res) => {
    const orderId = String(req.body?.orderId || "");
    const support = await Support.findOne({ paypalOrderId: orderId });
    if (!support) return res.status(404).json({ message: "Ese aporte no existe" });
    if (String(support.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Ese aporte no es tuyo" });
    }
    if (support.status === "pagado") {
      return res.json({ amount: support.amount, currency: support.currency });
    }

    let order;
    try {
      order = await paypal.captureOrder(orderId);
    } catch {
      return res.status(502).json({ message: "No se pudo confirmar el pago con PayPal" });
    }

    const capture = captureFromOrder(order);
    if (!capture) {
      return res.status(502).json({ message: "PayPal no confirmó el cobro" });
    }

    const saved = await markPaid(capture);
    res.json({ amount: saved.amount, currency: saved.currency });
  }),

  //! Avisos de PayPal. No llevan sesión: la única prueba de que son auténticos
  //! es la firma, así que sin comprobarla no se toca nada.
  webhook: asyncHandler(async (req, res) => {
    const valido = await paypal.verifyWebhook(req.headers, req.body);
    if (!valido) return res.status(400).json({ message: "Aviso no verificado" });

    const tipo = req.body?.event_type;
    const recurso = req.body?.resource;

    if (tipo === "PAYMENT.CAPTURE.COMPLETED") {
      await markPaid(recurso);

      //! ── Aporte mensual ──
      //! Cada cobro, incluido el del primer mes. Llega como "venta" y no como
      //! captura porque la API de suscripciones factura con el motor antiguo.
    } else if (tipo === "PAYMENT.SALE.COMPLETED") {
      await markSalePaid(recurso);
    } else if (tipo === "PAYMENT.SALE.REFUNDED" || tipo === "PAYMENT.SALE.REVERSED") {
      const devueltos = Math.round(parseFloat(recurso?.amount?.total ?? "0") * 100);
      const saleId = saleIdFromRefund(recurso);
      const aporte = saleId ? await Support.findOne({ paypalSaleId: saleId }) : null;

      //! Sin fila es de otro producto que comparte la app de PayPal, igual que
      //! en los reembolsos de captura; sin id no se puede saber, y eso sí grita
      if (!aporte) {
        if (!saleId) {
          console.error(
            "PayPal: reembolso de cobro mensual sin ningun id con el que buscarlo —",
            JSON.stringify({ refundId: recurso?.id, devueltos })
          );
        }
      } else if (devueltos > 0) {
        const { refundedCents, fullyRefunded } = applyRefund(
          aporte.amountCents,
          aporte.refundedCents,
          devueltos
        );
        aporte.refundedCents = refundedCents;
        aporte.refundedAt = new Date();
        if (fullyRefunded) aporte.status = "devuelto";
        await aporte.save();
      }
    } else if (
      tipo === "BILLING.SUBSCRIPTION.ACTIVATED" ||
      tipo === "BILLING.SUBSCRIPTION.CANCELLED" ||
      tipo === "BILLING.SUBSCRIPTION.SUSPENDED"
    ) {
      //! `id` en los avisos de suscripción es el de la suscripción misma
      const suscripcion = recurso?.id
        ? await Subscription.findOne({ paypalSubscriptionId: recurso.id })
        : null;

      //! Lo que no es nuestro se ignora sin ruido: no hay dinero en juego en
      //! estos avisos, solo el estado del compromiso
      if (suscripcion) {
        if (tipo === "BILLING.SUBSCRIPTION.ACTIVATED") {
          //! Cancelada de verdad no revive por un aviso rezagado
          if (suscripcion.status !== "cancelada") {
            suscripcion.status = "activa";
            suscripcion.activatedAt = suscripcion.activatedAt || new Date();
          }
        } else if (tipo === "BILLING.SUBSCRIPTION.CANCELLED") {
          suscripcion.status = "cancelada";
          suscripcion.cancelledAt = suscripcion.cancelledAt || new Date();
        } else {
          //! Suspendida no es cancelada: PayPal la para tras varios cobros
          //! fallidos y puede revivir sola si la tarjeta vuelve a funcionar
          if (suscripcion.status !== "cancelada") suscripcion.status = "suspendida";
        }
        await suscripcion.save();
      }
    } else if (tipo === "PAYMENT.CAPTURE.REFUNDED" || tipo === "PAYMENT.CAPTURE.REVERSED") {
      const { refundId, captureId, orderId, refundedCents: devueltos } = readRefund(recurso);

      //! Se busca por los dos ids, no solo por el de la captura: si el aviso
      //! llegara antes de que `markPaid` guardara ese id, el de la orden (que
      //! se guarda al abrirla) es el que salva la búsqueda. El de la captura se
      //! prueba además contra `paypalOrderId` porque en los avisos antiguos el
      //! enlace `up` traía el de la orden — a chat-app le pasó.
      const condiciones = [
        ...(captureId ? [{ paypalCaptureId: captureId }, { paypalOrderId: captureId }] : []),
        ...(orderId ? [{ paypalOrderId: orderId }] : []),
      ];
      const support = condiciones.length ? await Support.findOne({ $or: condiciones }) : null;

      if (!support) {
        //! Con ids y sin fila, el reembolso es de otro producto que comparte la
        //! app de PayPal (chat-app, holy_app): los avisos son de la cuenta, no
        //! de la app, así que llegan aquí igual. Se ignora en silencio.
        //!
        //! Pero sin ningún id no se puede saber si era nuestro, y eso sí se
        //! grita: podría ser dinero que salió sin que nadie se enterara.
        if (!condiciones.length) {
          console.error(
            "PayPal: reembolso sin ningún id con el que buscarlo —",
            JSON.stringify({ refundId, devueltos })
          );
        }
      } else if (devueltos > 0) {
        const { refundedCents, fullyRefunded } = applyRefund(
          support.amountCents,
          support.refundedCents,
          devueltos
        );
        support.refundedCents = refundedCents;
        support.refundedAt = new Date();
        if (fullyRefunded) support.status = "devuelto";
        await support.save();
      }
    }

    //! Siempre 200 a lo que no interesa: si no, PayPal lo reintenta sin parar
    res.status(200).json({ ok: true });
  }),
};

module.exports = supportController;
module.exports.markPaid = markPaid;
module.exports.markSalePaid = markSalePaid;
