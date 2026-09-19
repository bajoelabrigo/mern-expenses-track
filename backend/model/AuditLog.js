const mongoose = require("mongoose");

//! Historial de cambios de un espacio. Solo se escribe, nunca se edita: es lo
//! que permite explicar un descuadre meses después.
const auditLogSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    //! Nombre del actor en el momento del cambio: si la cuenta se borra, el
    //! historial sigue diciendo quién fue.
    actorName: { type: String, default: "" },
    //! p. ej. "transaction.create", "transaction.void", "member.role"
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    //! Estado antes/después (solo los campos relevantes)
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    note: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ workspace: 1, createdAt: -1 });
auditLogSchema.index({ workspace: 1, entityId: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
