const mongoose = require("mongoose");
const { fromCents } = require("../utils/money");

//! Paso de dinero de un fondo a otro (p. ej. del General a Construcción). No
//! es un ingreso ni un gasto: el total del espacio no cambia, solo cómo está
//! repartido. `null` en from/to es el fondo General.
const fundTransferSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    from: { type: mongoose.Schema.Types.ObjectId, ref: "Fund", default: null },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "Fund", default: null },
    amountCents: {
      type: Number,
      required: true,
      min: [1, "El monto debe ser mayor que cero"],
      validate: { validator: Number.isInteger, message: "Monto inválido" },
    },
    date: { type: Date, required: true, default: Date.now },
    note: { type: String, trim: true, default: "", maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    //! Como los movimientos: se anula, no se borra
    voided: { type: Boolean, default: false },
    voidReason: { type: String, trim: true, default: "", maxlength: 300 },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

fundTransferSchema.virtual("amount").get(function amount() {
  return fromCents(this.amountCents);
});

fundTransferSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.amountCents;
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

fundTransferSchema.index({ workspace: 1, date: -1 });

module.exports = mongoose.model("FundTransfer", fundTransferSchema);
