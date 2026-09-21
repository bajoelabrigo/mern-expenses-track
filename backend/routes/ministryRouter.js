const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const validateObjectId = require("../middlewares/validateObjectId");
const { withWorkspace, requireAnyPermission, requirePermission } = require("../middlewares/workspace");
const ctrl = require("../controllers/ministryController");

const ministryRouter = express.Router();

ministryRouter.use(isAuthenticated, withWorkspace);

//! El líder entra con "ministry:own": la lista le devuelve solo los suyos y
//! el detalle comprueba que el ministerio sea el que lleva.
const verAlguno = requireAnyPermission("ministry:read", "ministry:own");
const manage = requirePermission("ministry:manage");

ministryRouter.get("/", verAlguno, ctrl.list);
ministryRouter.get("/:id/gastos", validateObjectId(), verAlguno, ctrl.expenses);
ministryRouter.post("/", manage, ctrl.create);
ministryRouter.put("/:id", validateObjectId(), manage, ctrl.update);
ministryRouter.delete("/:id", validateObjectId(), manage, ctrl.delete);

module.exports = ministryRouter;
