const express = require("express");
const { publicLimiter } = require("../middlewares/rateLimiters");
const ctrl = require("../controllers/publicReportController");
const joinCtrl = require("../controllers/joinRequestController");

const publicReportRouter = express.Router();

//! ¿Existe ya una iglesia con este nombre? SIN sesión a propósito: lo usa el
//! formulario de registro para avisar antes de crear una iglesia gemela. No
//! devuelve ningún dato de la iglesia (ni cuentas ni miembros): solo sí o no.
//! Va antes de /:token para que "iglesias" no se lea como un token.
publicReportRouter.get("/iglesias/existe", publicLimiter, joinCtrl.churchExists);

//! SIN sesión a propósito: es el resumen que la iglesia comparte con su
//! congregación. Lleva su propio límite porque es lo único que cualquiera
//! puede pedir desde fuera.
publicReportRouter.get("/:token", publicLimiter, ctrl.show);

module.exports = publicReportRouter;
