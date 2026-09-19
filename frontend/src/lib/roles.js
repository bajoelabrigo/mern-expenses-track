//! Etiquetas de los roles de un espacio. Lo que cada rol PUEDE hacer lo decide
//! el backend (utils/permissions.js) y llega en `workspace.permissions`: aquí
//! solo se nombran.

export const ROLE_LABELS = {
  propietario: "Propietario",
  tesorero: "Tesorero",
  contador: "Contador",
  auditor: "Auditor",
  lector: "Lector",
};

export const ROLE_HELP = {
  propietario: "Todo, incluidos los ajustes y borrar el espacio",
  tesorero: "Registra movimientos e invita a contadores, auditores y lectores",
  contador: "Registra y corrige movimientos y categorías",
  auditor: "Solo lectura, incluido el historial de cambios",
  lector: "Solo lectura de movimientos y balances",
};

//! Roles que puede asignar cada rol (mismo criterio que canAssignRole del backend)
export const assignableRoles = (actorRole) => {
  if (actorRole === "propietario") return Object.keys(ROLE_LABELS);
  if (actorRole === "tesorero") return ["contador", "auditor", "lector"];
  return [];
};

//! ¿Puede el actor gestionar a un miembro con este rol? (canManageMember)
export const canManageMember = (actorRole, memberRole) =>
  actorRole === "propietario" ||
  (actorRole === "tesorero" && ["contador", "auditor", "lector"].includes(memberRole));
