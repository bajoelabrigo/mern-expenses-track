const mongoose = require("mongoose");

//! Petición de alguien que quiere entrar a un espacio que YA existe (una
//! iglesia, normalmente). Nace de la persona, no de quien ya está dentro: por eso
//! NO da acceso. Entra solo cuando un propietario o un tesorero la aprueba,
//! eligiendo el rol. Sin aprobación nadie ve los libros de una iglesia: escribir
//! el nombre no basta.
const joinRequestSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    //! Para que quien decide sepa quién es y qué necesita ("soy la tesorera")
    message: {
      type: String,
      trim: true,
      maxlength: [300, "El mensaje no puede superar los 300 caracteres"],
      default: "",
    },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

//! Una solicitud por persona y espacio: si la rechazan y vuelve a pedir, se
//! reutiliza la misma fila en vez de acumular historial
joinRequestSchema.index({ workspace: 1, user: 1 }, { unique: true });
joinRequestSchema.index({ user: 1, acceptedAt: 1, rejectedAt: 1 });

module.exports = mongoose.model("JoinRequest", joinRequestSchema);
