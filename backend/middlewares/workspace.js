const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const Workspace = require("../model/Workspace");
const Membership = require("../model/Membership");
const { can } = require("../utils/permissions");
const { repairDefaultWorkspace } = require("../services/workspaceService");

//! Cabecera con la que el cliente dice en qué espacio trabaja. Si no llega se
//! usa el espacio predeterminado del usuario: así un cliente viejo (que no la
//! envía) sigue funcionando sobre sus libros de siempre.
const HEADER = "x-workspace-id";

//! Resuelve req.workspace y req.role. Debe ir después de isAuthenticated.
const withWorkspace = asyncHandler(async (req, res, next) => {
  const requested = req.headers[HEADER];

  let workspaceId;
  if (requested) {
    if (!mongoose.Types.ObjectId.isValid(requested)) {
      return res.status(400).json({ message: "Espacio inválido" });
    }
    workspaceId = requested;
  } else {
    workspaceId = await repairDefaultWorkspace(req.user);
  }

  const [workspace, membership] = await Promise.all([
    Workspace.findById(workspaceId),
    Membership.findOne({ workspace: workspaceId, user: req.user._id }),
  ]);

  if (!workspace) {
    return res
      .status(404)
      .json({ message: "El espacio no existe", code: "WORKSPACE_NOT_FOUND" });
  }

  //! El administrador de la plataforma puede entrar a cualquier espacio (con
  //! permisos de propietario) para dar soporte; queda registrado en el
  //! historial con su nombre.
  let role = membership?.role;
  if (!role && req.user.role === "admin") role = "propietario";

  if (!role) {
    return res.status(403).json({
      message: "No perteneces a este espacio",
      code: "NOT_A_MEMBER",
    });
  }

  req.workspace = workspace;
  req.role = role;
  req.isPlatformSupport = !membership;
  next();
});

//! Exige un permiso del rol en el espacio actual.
const requirePermission = (permission) => (req, res, next) => {
  if (can(req.role, permission)) return next();
  return res.status(403).json({
    message: "Tu rol en este espacio no permite esta acción",
    code: "FORBIDDEN",
  });
};

module.exports = { withWorkspace, requirePermission, HEADER };
