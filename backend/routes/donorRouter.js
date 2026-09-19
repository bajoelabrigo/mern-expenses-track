const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const validateObjectId = require("../middlewares/validateObjectId");
const { withWorkspace, requirePermission } = require("../middlewares/workspace");
const donorController = require("../controllers/donorController");

const donorRouter = express.Router();

//! Todas exigen sesión, espacio y ver aportantes: quién dio cuánto es un dato
//! de la tesorería (donor:read), no de todo el que entra al espacio.
donorRouter.use(isAuthenticated, withWorkspace, requirePermission("donor:read"));

const write = requirePermission("donor:write");

donorRouter.get("/", donorController.list);
donorRouter.post("/", write, donorController.create);
donorRouter.get("/:id", validateObjectId(), donorController.getOne);
donorRouter.put("/:id", validateObjectId(), write, donorController.update);
donorRouter.delete("/:id", validateObjectId(), write, donorController.delete);

module.exports = donorRouter;
