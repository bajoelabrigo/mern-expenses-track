const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const validateObjectId = require("../middlewares/validateObjectId");
const { withWorkspace, requirePermission } = require("../middlewares/workspace");
const donorController = require("../controllers/donorController");

const donorRouter = express.Router();

//! Todas exigen sesión, espacio y ver personas: quién dio o recibió cuánto es un
//! dato de la tesorería (donor:read), no de todo el que entra al espacio.
donorRouter.use(isAuthenticated, withWorkspace, requirePermission("donor:read"));

const write = requirePermission("donor:write");

donorRouter.get("/", donorController.list);
donorRouter.post("/", write, donorController.create);
//! Las constancias y el informe antes de /:id para que no se lean como un id
donorRouter.get("/constancias", donorController.statements);
donorRouter.get("/constancias-pagos", donorController.paymentStatements);
donorRouter.get("/pagos", donorController.paymentsReport);
donorRouter.get("/:id", validateObjectId(), donorController.getOne);
donorRouter.get("/:id/constancia", validateObjectId(), donorController.statement);
donorRouter.get("/:id/constancia-pagos", validateObjectId(), donorController.paymentStatement);
donorRouter.put("/:id", validateObjectId(), write, donorController.update);
donorRouter.delete("/:id", validateObjectId(), write, donorController.delete);

module.exports = donorRouter;
