const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const { withWorkspace, requirePermission } = require("../middlewares/workspace");
const reportController = require("../controllers/reportController");

const reportRouter = express.Router();

//! Todas las rutas exigen sesión y trabajan sobre el espacio actual
reportRouter.use(isAuthenticated, withWorkspace);

//! Los informes son cifras agregadas: los ve cualquiera que pueda ver las
//! cuentas, incluido el auditor. No llevan nombres de aportantes.
const read = requirePermission("tx:read");

reportRouter.get("/mensual", read, reportController.monthly);
reportRouter.get("/anual", read, reportController.annual);

module.exports = reportRouter;
