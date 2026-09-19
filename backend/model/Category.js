const mongoose = require("mongoose");
const { INCOME_KINDS, effectiveIncomeKind } = require("../utils/incomeKinds");

const CategorySchema = new mongoose.Schema(
  {
    //! Las categorías son del espacio: todos sus miembros usan la misma lista
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
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
    //! Tipo de ingreso de iglesia (diezmo, ofrenda…). null = se deduce del
    //! nombre al leerla; solo las de ingreso lo usan.
    incomeKind: {
      type: String,
      enum: [...INCOME_KINDS, null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

//! La API siempre devuelve el tipo efectivo (guardado o deducido)
CategorySchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.incomeKind = effectiveIncomeKind(ret);
    delete ret.__v;
    return ret;
  },
});

//! Un usuario no puede repetir el nombre de categoría (garantía a nivel de BD)
CategorySchema.index({ workspace: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Category", CategorySchema);
