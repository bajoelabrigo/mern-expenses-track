const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "El nombre de la categoría es obligatorio"],
      trim: true,
      lowercase: true,
      default: "uncategorized",
    },
    type: {
      type: String,
      required: [true, "El tipo de categoría es obligatorio"],
      enum: {
        values: ["income", "expense"],
        message: "El tipo debe ser 'income' o 'expense'",
      },
    },
    icon: {
      type: String,
      default: "📁",
    },
  },
  {
    timestamps: true,
  }
);

//! Un usuario no puede repetir el nombre de categoría (garantía a nivel de BD)
CategorySchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Category", CategorySchema);
