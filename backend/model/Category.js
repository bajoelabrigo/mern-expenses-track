const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      default: "Uncategorized",
    },
    type: {
      type: String,
      required: true,
      enum: ["income", "expense"],
    },
    icon: {
      type: String,
      default: "📁", // icono por defecto si no se especifica
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Category", CategorySchema);
