const mongoose = require("mongoose");

//! Aportante: quien da diezmos u ofrendas. Es un dato sensible: quién dio
//! cuánto solo lo ve la tesorería (permiso donor:read).
const donorSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    name: {
      type: String,
      required: [true, "El nombre del aportante es obligatorio"],
      trim: true,
      maxlength: [80, "El nombre no puede superar los 80 caracteres"],
    },
    //! Nombre en minúsculas, para no repetir a la misma persona
    key: { type: String, required: true },
    //! DNI, RUC o el número que use la iglesia; sirve para las constancias
    document: { type: String, trim: true, default: "", maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, default: "", maxlength: 120 },
    phone: { type: String, trim: true, default: "", maxlength: 30 },
    notes: { type: String, trim: true, default: "", maxlength: 300 },
    //! Quien ya no aporta (se mudó, falleció): deja de ofrecerse al registrar,
    //! pero su historial se conserva para las constancias
    archived: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

donorSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.key;
    delete ret.__v;
    return ret;
  },
});

donorSchema.index({ workspace: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("Donor", donorSchema);
