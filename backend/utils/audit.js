const AuditLog = require("../model/AuditLog");
const notificationService = require("../services/notificationService");
const { effectiveIncomeKind } = require("./incomeKinds");

//! Campos de un movimiento que se guardan en el historial (antes/después).
//! Se guardan en unidades, igual que los ve el usuario.
//! `fundName`: el nombre del fondo en ese momento (el historial debe decir
//! "Misiones" aunque el fondo se renombre o archive después).
const transactionSnapshot = (tx, fundName) =>
  tx && {
    type: tx.type,
    category: tx.category,
    ...(fundName !== undefined ? { fund: fundName } : {}),
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
    ...(category.type === "income" ? { incomeKind: effectiveIncomeKind(category) } : {}),
  };

const fundSnapshot = (fund) =>
  fund && {
    name: fund.name,
    icon: fund.icon,
    description: fund.description,
    goal: fund.goal,
    archived: fund.archived,
  };

//! Registra un cambio. Un fallo al escribir el historial NO debe deshacer ni
//! bloquear la operación que ya se hizo: se registra en el log del servidor.
const audit = async (req, { action, entity, entityId, before, after, note }) => {
  try {
    const entrada = await AuditLog.create({
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

    //! Los avisos al equipo salen de aquí. El historial es el único sitio por el
    //! que pasan TODOS los cambios, así que avisar aquí evita acordarse de
    //! hacerlo en cada controlador (y que se olvide en los que se añadan
    //! mañana). No se espera: un aviso que falle no puede retrasar el cambio que
    //! ya está hecho.
    notificationService
      .avisar({
        entrada: entrada.toObject(),
        workspace: req.workspace,
        actorName: req.user.username,
      })
      .catch((err) => console.error(`[aviso] No se pudo avisar de ${action}:`, err.message));
  } catch (err) {
    console.error(`[audit] No se pudo registrar ${action}:`, err.message);
  }
};

module.exports = { audit, transactionSnapshot, categorySnapshot, fundSnapshot };
