const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const validateObjectId = require("../middlewares/validateObjectId");
const { withWorkspace, requirePermission, HEADER } = require("../middlewares/workspace");
const { emailLimiter } = require("../middlewares/rateLimiters");
const ctrl = require("../controllers/workspaceController");

const router = express.Router();

router.use(isAuthenticated);

router.get("/", ctrl.listMine);
router.post("/", ctrl.create);

//! En /workspaces/:id el espacio viene en la URL: se pasa al mismo middleware
//! que usan las demás rutas (que lo leen de la cabecera).
const fromParam = (req, res, next) => {
  req.headers[HEADER] = req.params.id;
  next();
};
const scoped = [validateObjectId(), fromParam, withWorkspace];

router.get("/:id", scoped, requirePermission("tx:read"), ctrl.getOne);
router.put("/:id", scoped, requirePermission("workspace:manage"), ctrl.update);
router.delete("/:id", scoped, requirePermission("workspace:delete"), ctrl.remove);

router.get("/:id/members", scoped, requirePermission("tx:read"), ctrl.listMembers);
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

router.get("/:id/audit", scoped, requirePermission("audit:read"), ctrl.listAudit);

module.exports = router;
