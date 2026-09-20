const mongoose = require("mongoose");
const { fromCents } = require("../utils/money");

//! El conteo de la ofrenda de un culto, con doble firma.
//!
//! Por qué existe: la ofrenda se cuenta entre dos personas y las dos firman.
//! Si una sola pudiera registrar el total, nadie podría comprobar que lo que
//! entró al libro es lo que había en la canasta. Aquí el movimiento NO se crea
//! hasta que una segunda persona confirma el conteo: hasta entonces el dinero
//! está contado pero no asentado.
const offeringCountSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    date: { type: Date, required: true },
    //! De qué culto o reunión ("Culto del domingo", "Reunión de oración")
    service: { type: String, trim: true, required: true, maxlength: 80 },

    //! El desglose por denominación, tal como se cuenta en la mesa. Es
    //! opcional: hay iglesias que solo apuntan el total.
    breakdown: [
      {
        _id: false,
        //! Valor de la denominación en centavos (un billete de 50 = 5000)
        valueCents: { type: Number, required: true, min: 1 },
        count: { type: Number, required: true, min: 0 },
      },
    ],
    amountCents: { type: Number, required: true, min: 1 },

    //! Dónde se asienta cuando se confirma
    category: { type: String, trim: true, lowercase: true, default: "ofrendas" },
    fund: { type: mongoose.Schema.Types.ObjectId, ref: "Fund", default: null },
    note: { type: String, trim: true, default: "", maxlength: 300 },

    //! Las dos firmas
    countedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    confirmedAt: { type: Date, default: null },

    //! El movimiento que se creó al confirmar
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },

    status: {
      type: String,
      enum: ["pendiente", "confirmado", "anulado"],
      default: "pendiente",
    },
    voidReason: { type: String, trim: true, default: "", maxlength: 300 },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

offeringCountSchema.virtual("amount").get(function amount() {
  return fromCents(this.amountCents);
});

offeringCountSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.amountCents;
    if (Array.isArray(ret.breakdown)) {
      ret.breakdown = ret.breakdown.map((row) => ({
        value: fromCents(row.valueCents),
        count: row.count,
      }));
    }
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

offeringCountSchema.index({ workspace: 1, date: -1 });

module.exports = mongoose.model("OfferingCount", offeringCountSchema);
