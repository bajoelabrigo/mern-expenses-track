const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const { withWorkspace } = require("../middlewares/workspace");
const ctrl = require("../controllers/notificationController");

const notificationRouter = express.Router();

//! Cualquier miembro del espacio tiene sus avisos: el rol decide QUÉ ve (lo
//! filtra el servicio), no si puede entrar.
notificationRouter.use(isAuthenticated, withWorkspace);

notificationRouter.get("/", ctrl.list);
notificationRouter.post("/leidas", ctrl.markRead);

//! Avisos al teléfono
notificationRouter.get("/push", ctrl.pushStatus);
notificationRouter.post("/push", ctrl.subscribe);
notificationRouter.delete("/push", ctrl.unsubscribe);
notificationRouter.post("/prueba", ctrl.test);

module.exports = notificationRouter;
