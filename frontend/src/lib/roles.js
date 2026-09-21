//! Etiquetas de los roles de un espacio. Lo que cada rol PUEDE hacer lo decide
//! el backend (utils/permissions.js) y llega en `workspace.permissions`: aquí
//! solo se nombran.

export const ROLE_LABELS = {
  propietario: "Propietario",
  tesorero: "Tesorero",
  contador: "Contador",
  auditor: "Auditor",
  lector: "Lector",
  lider: "Líder de ministerio",
};

export const ROLE_HELP = {
  propietario: "Todo, incluidos los ajustes y borrar el espacio",
  tesorero: "Registra movimientos e invita a contadores, auditores, lectores y líderes",
  contador: "Registra y corrige movimientos y categorías",
  auditor: "Solo lectura, incluido el historial de cambios",
  lector: "Solo lectura de movimientos y balances",
  //! No ve el libro: solo el ministerio que lleva
  lider: "Solo su ministerio: su presupuesto y en qué se ha ido",
};

//! Roles que puede asignar cada rol (mismo criterio que canAssignRole del
//! backend). `kind`: el líder de ministerio solo se ofrece en una iglesia,
//! que es donde hay ministerios con presupuesto.
export const assignableRoles = (actorRole, kind) => {
  const todos =
    actorRole === "propietario"
      ? Object.keys(ROLE_LABELS)
      : actorRole === "tesorero"
      ? ["contador", "auditor", "lector", "lider"]
      : [];
  return kind && kind !== "iglesia" ? todos.filter((r) => r !== "lider") : todos;
};

//! ¿Puede el actor gestionar a un miembro con este rol? (canManageMember)
export const canManageMember = (actorRole, memberRole) =>
  actorRole === "propietario" ||
  (actorRole === "tesorero" &&
    ["contador", "auditor", "lector", "lider"].includes(memberRole));
