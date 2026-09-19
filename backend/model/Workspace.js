const mongoose = require("mongoose");
const { CURRENCIES } = require("../utils/money");

//! Un espacio agrupa los libros de una persona o de una iglesia. Movimientos y
//! categorías pertenecen a un espacio; quién entra y con qué rol lo dice
//! Membership.
const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre del espacio es obligatorio"],
      trim: true,
      minlength: [2, "El nombre debe tener al menos 2 caracteres"],
      maxlength: [80, "El nombre no puede superar los 80 caracteres"],
    },
    kind: {
      type: String,
      enum: {
        values: ["personal", "iglesia"],
        message: "El tipo de espacio debe ser 'personal' o 'iglesia'",
      },
      required: true,
    },
    currency: {
      type: String,
      enum: { values: CURRENCIES, message: "Moneda no admitida" },
      default: "USD",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Workspace", workspaceSchema);
