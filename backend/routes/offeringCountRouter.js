const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const validateObjectId = require("../middlewares/validateObjectId");
const { withWorkspace, requirePermission } = require("../middlewares/workspace");
const ctrl = require("../controllers/offeringCountController");

const offeringCountRouter = express.Router();

offeringCountRouter.use(isAuthenticated, withWorkspace);

const read = requirePermission("tx:read");
//! Contar y firmar es cosa de quien puede registrar movimientos. Que las dos
//! firmas sean de personas distintas se comprueba en el controlador.
const write = requirePermission("tx:write");

offeringCountRouter.get("/", read, ctrl.list);
offeringCountRouter.post("/", write, ctrl.create);
offeringCountRouter.post("/:id/confirmar", validateObjectId(), write, ctrl.confirm);
offeringCountRouter.post("/:id/anular", validateObjectId(), write, ctrl.void);

module.exports = offeringCountRouter;
