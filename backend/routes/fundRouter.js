const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const validateObjectId = require("../middlewares/validateObjectId");
const { withWorkspace, requirePermission } = require("../middlewares/workspace");
const fundController = require("../controllers/fundController");

const fundRouter = express.Router();

//! Todas las rutas exigen sesión y trabajan sobre el espacio actual
fundRouter.use(isAuthenticated, withWorkspace);

const read = requirePermission("tx:read");
const manage = requirePermission("fund:manage");

fundRouter.get("/", read, fundController.list);
fundRouter.post("/", manage, fundController.create);
//! Pases entre fondos antes que /:id para que "transfers" no se lea como id
fundRouter.get("/transfers", read, fundController.listTransfers);
fundRouter.post("/transfers", manage, fundController.createTransfer);
fundRouter.post("/transfers/:id/void", validateObjectId(), manage, fundController.voidTransfer);
//! El informe acepta "general" como id, así que valida el fondo por dentro
fundRouter.get("/:id/informe", read, fundController.report);
fundRouter.put("/:id", validateObjectId(), manage, fundController.update);
fundRouter.delete("/:id", validateObjectId(), manage, fundController.delete);

module.exports = fundRouter;
