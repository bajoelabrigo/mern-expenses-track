const asyncHandler = require("express-async-handler");
const Support = require("../model/Support");
const { toCents, fromCents } = require("../utils/money");
const {
  paypal,
  readCapture,
  captureFromOrder,
  captureIdFromRefund,
  applyRefund,
} = require("../services/paypal");

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

const supportController = {
  //! Si se puede aportar ahora mismo. La página lo consulta antes de pintar
  //! nada: sin claves de PayPal no tiene sentido ofrecer el botón.
  status: asyncHandler(async (req, res) => {
    const disponible = paypal.isConfigured();
    const mios = req.user
      ? await Support.find({ user: req.user._id, status: "pagado" }).sort({ paidAt: -1 }).limit(10)
      : [];

    res.json({
      disponible,
      //! Lo que ha aportado esta persona, para darle las gracias
      total: fromCents(mios.reduce((suma, s) => suma + s.amountCents - s.refundedCents, 0)),
      aportes: mios.map((s) => ({ amount: s.amount, currency: s.currency, paidAt: s.paidAt })),
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
    } else if (tipo === "PAYMENT.CAPTURE.REFUNDED" || tipo === "PAYMENT.CAPTURE.REVERSED") {
      const devueltos = Math.round(parseFloat(recurso?.amount?.value ?? "0") * 100);
      const captureId = captureIdFromRefund(recurso);
      const support = captureId ? await Support.findOne({ paypalCaptureId: captureId }) : null;

      if (!support) {
        //! No se calla: es dinero que salió y nadie se enteró
        console.error(
          "PayPal: reembolso sin aporte que le corresponda —",
          JSON.stringify({ captureId, devueltos })
        );
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
