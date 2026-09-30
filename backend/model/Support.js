const mongoose = require("mongoose");
const { fromCents } = require("../utils/money");

//! Un aporte de socio: dinero que alguien da para sostener la app. NO es una
//! ofrenda de iglesia ni un movimiento de ningún espacio; vive aparte a
//! propósito, para que nunca se mezcle con las cuentas de nadie.
const supportSchema = new mongoose.Schema(
  {
    //! Quién aportó. Se queda aunque borre su cuenta (el dinero existió).
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    //! Copia del correo por si la cuenta desaparece
    email: { type: String, trim: true, default: "" },

    //! Identificadores de PayPal. `orderId` es único: PayPal reenvía los
    //! avisos y sin esto el mismo aporte se guardaría dos veces.
    paypalOrderId: { type: String, index: true, unique: true, sparse: true },
    //! Por donde llega un reembolso más adelante
    paypalCaptureId: { type: String, default: "" },

    //! ── Si este aporte es un cobro mensual de una suscripción ──
    //! De qué compromiso salió. Vacío en los aportes de una vez.
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    //! Los cobros de una suscripción NO llegan como captura sino como "venta"
    //! (PAYMENT.SALE.COMPLETED): la API de suscripciones factura con el motor
    //! antiguo de pagos por debajo. Por eso llevan su propio id, y es por donde
    //! llega su reembolso. Único, para que un aviso reenviado no cobre dos veces.
    paypalSaleId: { type: String, index: true, unique: true, sparse: true },

    amountCents: { type: Number, required: true, min: 0 },
    //! Lo que se queda PayPal: el ingreso real es amount - fee
    feeCents: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },

    status: {
      type: String,
      enum: ["pendiente", "pagado", "devuelto"],
      default: "pendiente",
    },
    //! Un reembolso parcial no anula el aporte: se guarda cuánto se devolvió
    refundedCents: { type: Number, default: 0 },
    refundedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supportSchema.virtual("amount").get(function amount() {
  return fromCents(this.amountCents);
});

supportSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    //! Los ids de PayPal y las comisiones no salen de la API
    delete ret.amountCents;
    delete ret.feeCents;
    delete ret.refundedCents;
    delete ret.paypalOrderId;
    delete ret.paypalCaptureId;
    delete ret.paypalSaleId;
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

module.exports = mongoose.model("Support", supportSchema);
