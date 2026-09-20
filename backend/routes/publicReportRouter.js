const express = require("express");
const { publicLimiter } = require("../middlewares/rateLimiters");
const ctrl = require("../controllers/publicReportController");

const publicReportRouter = express.Router();

//! SIN sesión a propósito: es el resumen que la iglesia comparte con su
//! congregación. Lleva su propio límite porque es lo único que cualquiera
//! puede pedir desde fuera.
publicReportRouter.get("/:token", publicLimiter, ctrl.show);

module.exports = publicReportRouter;
