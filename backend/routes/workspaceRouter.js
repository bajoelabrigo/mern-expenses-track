const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const validateObjectId = require("../middlewares/validateObjectId");
const { withWorkspace, requirePermission, HEADER } = require("../middlewares/workspace");
const { emailLimiter } = require("../middlewares/rateLimiters");
const { logoUpload } = require("../middlewares/logoUpload");
const ctrl = require("../controllers/workspaceController");
const joinCtrl = require("../controllers/joinRequestController");
const publicLink = require("../controllers/publicReportController");

const router = express.Router();

router.use(isAuthenticated);

router.get("/", ctrl.listMine);
router.post("/", ctrl.create);

//! Solicitudes para entrar a un espacio que ya existe. Estas rutas van ANTES de
//! /:id para que "buscar", "mis-solicitudes" y "solicitudes" no se lean como un id.
router.get("/buscar", joinCtrl.search);
router.get("/mis-solicitudes", joinCtrl.listMine);
router.delete(
  "/solicitudes/:requestId",
  validateObjectId("requestId"),
  joinCtrl.withdraw
);
//! Pedir entrar lo hace alguien que NO es miembro (es justo lo contrario), así
//! que va sin withWorkspace: el controlador busca el espacio por el id de la URL.
//! Lleva el límite de correos porque avisa a la tesorería del espacio.
router.post(
  "/:id/solicitudes",
  validateObjectId(),
  emailLimiter,
  joinCtrl.create
);

//! En /workspaces/:id el espacio viene en la URL: se pasa al mismo middleware
//! que usan las demás rutas (que lo leen de la cabecera).
const fromParam = (req, res, next) => {
  req.headers[HEADER] = req.params.id;
  next();
};
const scoped = [validateObjectId(), fromParam, withWorkspace];

router.get("/:id", scoped, requirePermission("tx:read"), ctrl.getOne);
router.put("/:id", scoped, requirePermission("workspace:manage"), ctrl.update);
//! El enlace de solo lectura para la congregación. Publicar las cuentas es
//! decisión del propietario, de nadie más.
const manageLink = requirePermission("workspace:manage");
router.get("/:id/enlace-publico", scoped, manageLink, publicLink.get);
router.post("/:id/enlace-publico", scoped, manageLink, publicLink.create);
router.put("/:id/enlace-publico", scoped, manageLink, publicLink.update);
router.delete("/:id/enlace-publico", scoped, manageLink, publicLink.remove);

//! El logo del espacio (lo que sale impreso en los informes)
router.put(
  "/:id/logo",
  scoped,
  requirePermission("workspace:manage"),
  logoUpload,
  ctrl.setLogo
);
router.delete(
  "/:id/logo",
  scoped,
  requirePermission("workspace:manage"),
  ctrl.removeLogo
);
router.delete("/:id", scoped, requirePermission("workspace:delete"), ctrl.remove);

router.get("/:id/members", scoped, requirePermission("tx:read"), ctrl.listMembers);
//! Alta directa de alguien que ya tiene cuenta (sin invitación ni confirmación).
//! Sin emailLimiter a propósito: ese límite corta a las 5 peticiones cada 15
//! minutos y dejaría a una iglesia sin poder dar de alta a su equipo; aquí el
//! permiso members:manage ya es la barrera.
router.post("/:id/members", scoped, requirePermission("members:manage"), ctrl.addMember);
router.put(
  "/:id/members/:userId",
  scoped,
  validateObjectId("userId"),
  requirePermission("members:manage"),
  ctrl.updateMemberRole
);
//! Sin requirePermission: salir del espacio lo puede hacer cualquiera; quitar
//! a otro lo comprueba el controlador.
router.delete(
  "/:id/members/:userId",
  scoped,
  validateObjectId("userId"),
  ctrl.removeMember
);

router.get(
  "/:id/invitations",
  scoped,
  requirePermission("members:manage"),
  ctrl.listInvitations
);
router.post(
  "/:id/invitations",
  scoped,
  requirePermission("members:manage"),
  emailLimiter,
  ctrl.createInvitation
);
router.delete(
  "/:id/invitations/:invitationId",
  scoped,
  validateObjectId("invitationId"),
  requirePermission("members:manage"),
  ctrl.revokeInvitation
);

//! Solicitudes para entrar: las ve y las resuelve quien gestiona miembros
router.get(
  "/:id/solicitudes",
  scoped,
  requirePermission("members:manage"),
  joinCtrl.listForWorkspace
);
router.post(
  "/:id/solicitudes/:requestId/aprobar",
  scoped,
  validateObjectId("requestId"),
  requirePermission("members:manage"),
  joinCtrl.approve
);
router.post(
  "/:id/solicitudes/:requestId/rechazar",
  scoped,
  validateObjectId("requestId"),
  requirePermission("members:manage"),
  joinCtrl.reject
);

router.get("/:id/audit", scoped, requirePermission("audit:read"), ctrl.listAudit);

module.exports = router;
