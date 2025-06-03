const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["income", "expense"],
    },
    category: {
      type: String,
      required: true,
      default: "Uncategorized",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
    },
    icon: {
      type: String,
      default: "", // puedes cambiar a "💰" si quieres un ícono por defecto
    },
    recurrent: {
      type: Boolean,
      default: false,
    },
    recurrenceType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      default: null,
    },
    recurrenceCount: {
      type: Number, // ¿cuántas veces se repetirá?
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);
