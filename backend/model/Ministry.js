const mongoose = require("mongoose");
const { fromCents } = require("../utils/money");

//! Un ministerio con su presupuesto anual: jóvenes, damas, misiones, música.
//!
//! No es lo mismo que un fondo. Un fondo es una bolsa de dinero apartada; un
//! ministerio es un permiso para gastar hasta cierto tope. El de jóvenes puede
//! tener 3.000 al año para gastar del dinero general, sin que ese dinero esté
//! separado en ninguna parte.
const ministrySchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    name: {
      type: String,
      required: [true, "El nombre del ministerio es obligatorio"],
      trim: true,
      maxlength: [60, "El nombre no puede superar los 60 caracteres"],
    },
    //! Para que no haya dos con el mismo nombre en un espacio
    key: { type: String, required: true, lowercase: true, trim: true },
    icon: { type: String, trim: true, default: "🙌", maxlength: 16 },

    //! Presupuesto del año. Se guarda por año para poder cambiarlo cada enero
    //! sin perder de vista lo que se aprobó el año anterior.
    year: { type: Number, required: true, min: 2000, max: 2100 },
    budgetCents: { type: Number, required: true, min: 0 },

    //! Quién lo lleva. Ve y pide sobre SU presupuesto, nada más.
    leader: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    archived: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ministrySchema.virtual("budget").get(function budget() {
  return fromCents(this.budgetCents);
});

ministrySchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.budgetCents;
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

//! Un ministerio por nombre y año dentro del espacio
ministrySchema.index({ workspace: 1, key: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("Ministry", ministrySchema);
