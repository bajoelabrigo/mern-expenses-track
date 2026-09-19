const AuditLog = require("../model/AuditLog");

//! Campos de un movimiento que se guardan en el historial (antes/después).
//! Se guardan en unidades, igual que los ve el usuario.
const transactionSnapshot = (tx) =>
  tx && {
    type: tx.type,
    category: tx.category,
    amount: tx.amount,
    date: tx.date,
    description: tx.description,
    voided: tx.voided,
    voidReason: tx.voidReason,
  };

const categorySnapshot = (category) =>
  category && {
    name: category.name,
    type: category.type,
    icon: category.icon,
  };

//! Registra un cambio. Un fallo al escribir el historial NO debe deshacer ni
//! bloquear la operación que ya se hizo: se registra en el log del servidor.
const audit = async (req, { action, entity, entityId, before, after, note }) => {
  try {
    await AuditLog.create({
      workspace: req.workspace._id,
      actor: req.user._id,
      actorName: req.user.username,
      action,
      entity,
      entityId: entityId || null,
      before: before || null,
      after: after || null,
      note: note || "",
    });
  } catch (err) {
    console.error(`[audit] No se pudo registrar ${action}:`, err.message);
  }
};

module.exports = { audit, transactionSnapshot, categorySnapshot };
