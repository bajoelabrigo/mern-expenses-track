const mongoose = require("mongoose");
const { fromCents } = require("../utils/money");

//! Fondo de un espacio: dinero apartado para un fin (misiones, construcción,
//! benevolencia). El fondo "General" no se guarda: es todo movimiento sin
//! fondo asignado, así los datos que ya existían no necesitan migrarse.
const fundSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    name: {
      type: String,
      required: [true, "El nombre del fondo es obligatorio"],
      trim: true,
      maxlength: [60, "El nombre no puede superar los 60 caracteres"],
    },
    //! Nombre en minúsculas para que "Misiones" y "misiones" no convivan
    key: { type: String, required: true },
    icon: { type: String, default: "🏦", maxlength: 16 },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [200, "La descripción no puede superar los 200 caracteres"],
    },
    //! Meta opcional (campaña): cuánto se quiere juntar, en centavos
    goalCents: {
      type: Number,
      default: null,
      validate: {
        validator: (v) => v === null || (Number.isInteger(v) && v > 0),
        message: "La meta debe ser un monto positivo",
      },
    },
    //! Un fondo con movimientos no se borra: se archiva (deja de ofrecerse al
    //! registrar, pero su historia y su saldo siguen a la vista)
    archived: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

fundSchema.virtual("goal").get(function goal() {
  return this.goalCents === null || this.goalCents === undefined ? null : fromCents(this.goalCents);
});

fundSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.goalCents;
    delete ret.key;
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

fundSchema.index({ workspace: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("Fund", fundSchema);
