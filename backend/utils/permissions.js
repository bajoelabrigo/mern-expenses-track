//! Roles dentro de un espacio y lo que puede hacer cada uno.
//! Es la única fuente de verdad: el frontend recibe la lista de permisos ya
//! calculada (GET /workspaces) y no replica estas reglas.

const ROLES = ["propietario", "tesorero", "contador", "auditor", "lector"];

const PERMISSIONS = {
  //! Ver movimientos, categorías y balances
  "tx:read": ["propietario", "tesorero", "contador", "auditor", "lector"],
  //! Crear, editar y anular movimientos
  "tx:write": ["propietario", "tesorero", "contador"],
  //! Borrar un movimiento definitivamente (lo normal es anularlo)
  "tx:purge": ["propietario"],
  "category:write": ["propietario", "tesorero", "contador"],
  //! Invitar, cambiar roles y quitar miembros
  "members:manage": ["propietario", "tesorero"],
  "audit:read": ["propietario", "tesorero", "auditor"],
  //! Nombre, moneda y demás ajustes del espacio
  "workspace:manage": ["propietario"],
  "workspace:delete": ["propietario"],
};

const can = (role, permission) =>
  Boolean(PERMISSIONS[permission] && PERMISSIONS[permission].includes(role));

const permissionsFor = (role) =>
  Object.keys(PERMISSIONS).filter((permission) => can(role, permission));

//! Un tesorero gestiona miembros, pero no puede nombrar ni tocar propietarios:
//! si pudiera, se haría propietario a sí mismo.
const canAssignRole = (actorRole, targetRole) => {
  if (actorRole === "propietario") return ROLES.includes(targetRole);
  if (actorRole === "tesorero") {
    return ["contador", "auditor", "lector"].includes(targetRole);
  }
  return false;
};

module.exports = { ROLES, PERMISSIONS, can, permissionsFor, canAssignRole };
