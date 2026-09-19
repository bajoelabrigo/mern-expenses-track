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
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

transactionSchema.index({ workspace: 1, date: -1 });
transactionSchema.index({ workspace: 1, category: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
