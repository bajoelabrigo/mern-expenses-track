const mongoose = require("mongoose");

//! Persona del espacio. Es quien da (diezmos, ofrendas: `donor` en el
//! movimiento) y también quien recibe un pago por un trabajo (`payee` en el
//! movimiento de gasto). Una sola ficha por persona: la misma hermana que
//! ofrenda es la que un mes cocina y cobra, y sus dos cifras viven aquí. Es un
//! dato sensible: quién dio o recibió cuánto solo lo ve la tesorería
//! (permiso donor:read).
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
    //! ¿Es miembro de la congregación? Solo informativo: en los informes permite
    //! separar lo que se pagó a los hermanos de lo que se pagó a proveedores de
    //! fuera. No tiene nada que ver con Membership (quien entra a la app).
    member: { type: Boolean, default: false },
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
