const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const supportController = require("../controllers/supportController");

const supportRouter = express.Router();

//! El aviso de PayPal NO lleva sesión: su autenticidad es la firma, que se
//! comprueba dentro. Va antes del isAuthenticated de abajo a propósito.
supportRouter.post("/webhook", supportController.webhook);

supportRouter.use(isAuthenticated);

//! Aportar es cosa de la persona, no de un espacio: no lleva X-Workspace-Id
//! ni permisos de rol. Cualquiera con cuenta puede hacerse socio.
supportRouter.get("/estado", supportController.status);
supportRouter.post("/orden", supportController.createOrder);
supportRouter.post("/capturar", supportController.capture);

//! Aporte mensual. No hay un "capturar" que le corresponda: quien confirma el
//! cobro es el aviso de PayPal, porque la persona aprueba la suscripción fuera
//! de la app y vuelve cuando ya está hecha.
supportRouter.post("/suscripcion", supportController.crearSuscripcion);
supportRouter.delete("/suscripcion", supportController.cancelarSuscripcion);

module.exports = supportRouter;
