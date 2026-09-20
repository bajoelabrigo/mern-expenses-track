const mongoose = require("mongoose");
const { fromCents } = require("../utils/money");

const transactionSchema = new mongoose.Schema(
  {
    //! Los libros son del espacio, no de la persona que anotó el movimiento
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: [true, "El tipo de transacción es obligatorio"],
      enum: {
        values: ["income", "expense"],
        message: "El tipo debe ser 'income' o 'expense'",
      },
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: "uncategorized",
    },
    //! Quién dio este ingreso (opcional, solo ingresos). Sensible: la API lo
    //! oculta a quien no tenga donor:read.
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donor",
      default: null,
    },
    //! Fondo al que pertenece; null = fondo General (lo que no tiene fondo)
    fund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fund",
      default: null,
    },
    //! Ministerio al que se le carga el gasto (jóvenes, damas…). Solo los
    //! gastos lo llevan: es contra su presupuesto que cuenta.
    ministry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ministry",
      default: null,
    },
    //! Centavos enteros. La API expone `amount` (virtual) en unidades.
    amountCents: {
      type: Number,
      required: [true, "El monto es obligatorio"],
      min: [1, "El monto debe ser mayor que cero"],
      validate: {
        validator: Number.isInteger,
        message: "El monto en centavos debe ser un entero",
      },
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "La descripción no puede superar los 500 caracteres"],
    },
    icon: {
      type: String,
      default: "",
    },
    recurrent: {
      type: Boolean,
      default: false,
    },
    recurrenceType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", null],
      default: null,
    },
    recurrenceCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    //! Identificador que genera el cliente al registrar sin conexión: si el
    //! mismo movimiento llega dos veces (se reintentó sin saber que el primer
    //! envío sí llegó), no se duplica.
    clientId: { type: String, trim: true, maxlength: 64 },
    //! Comprobante (foto o PDF) en Cloudinary con entrega autenticada. El
    //! publicId no se expone: se ve con un enlace firmado y temporal.
    receipt: {
      type: new mongoose.Schema(
        {
          publicId: { type: String, required: true },
          resourceType: { type: String, enum: ["image", "raw"], required: true },
          format: { type: String, default: "" },
          bytes: { type: Number, default: 0 },
          uploadedAt: { type: Date, default: Date.now },
          uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        },
        { _id: false }
      ),
      default: null,
    },
    //! Anulación: la fila se sigue viendo (tachada, con su motivo) pero deja de
    //! sumar. Un movimiento que desaparece sin rastro hace imposible explicar
    //! un descuadre después.
    voided: { type: Boolean, default: false },
    voidReason: { type: String, trim: true, maxlength: 300, default: "" },
    voidedAt: { type: Date, default: null },
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.virtual("amount").get(function amount() {
  return fromCents(this.amountCents);
});

transactionSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.amountCents;
    //! Del comprobante solo se dice que existe y qué es
    ret.receipt = ret.receipt
      ? { format: ret.receipt.format, bytes: ret.receipt.bytes, uploadedAt: ret.receipt.uploadedAt }
      : null;
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

transactionSchema.index({ workspace: 1, date: -1 });
transactionSchema.index(
  { workspace: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } }
);
transactionSchema.index({ workspace: 1, category: 1 });
transactionSchema.index({ workspace: 1, fund: 1 });
transactionSchema.index({ workspace: 1, donor: 1, date: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);
