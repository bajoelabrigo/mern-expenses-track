const mongoose = require("mongoose");
const { fromCents } = require("../utils/money");

//! El compromiso de aportar cada mes. Vive aparte de los aportes (Support)
//! porque son dos cosas distintas: esto es la promesa, y cada cobro mensual
//! es un aporte con su propia fila. Así, cancelar no borra lo ya aportado, y
//! el historial sigue cuadrando.
const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    //! Copia del correo por si la cuenta desaparece
    email: { type: String, trim: true, default: "" },

    //! El id de PayPal (I-XXXX). Único: PayPal reenvía los avisos, y sin esto
    //! la misma suscripción se guardaría dos veces.
    paypalSubscriptionId: { type: String, index: true, unique: true, sparse: true },
    //! De qué plan salió, para saber de cuánto es sin volver a preguntar
    planId: { type: String, default: "" },

    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },

    //! "pendiente" mientras no la aprueban en PayPal; muchas se quedan ahí
    //! para siempre, porque la gente abre el pago y no lo termina.
    //! "suspendida" la pone PayPal cuando falla el cobro varias veces: no es
    //! una cancelación, puede revivir sola si la tarjeta vuelve a funcionar.
    status: {
      type: String,
      enum: ["pendiente", "activa", "cancelada", "suspendida"],
      default: "pendiente",
    },

    activatedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    //! Cuándo entró el último cobro; lo actualiza cada PAYMENT.SALE.COMPLETED
    lastPaymentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

subscriptionSchema.virtual("amount").get(function amount() {
  return fromCents(this.amountCents);
});

subscriptionSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    //! Los ids de PayPal no salen de la API
    delete ret.amountCents;
    delete ret.paypalSubscriptionId;
    delete ret.planId;
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

module.exports = mongoose.model("Subscription", subscriptionSchema);
