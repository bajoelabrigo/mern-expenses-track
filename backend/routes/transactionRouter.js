const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const validateObjectId = require("../middlewares/validateObjectId");
const { withWorkspace, requirePermission } = require("../middlewares/workspace");
const transactionController = require("../controllers/transactionController");

const transactionRouter = express.Router();

//! Todas las rutas exigen sesión y trabajan sobre el espacio actual
transactionRouter.use(isAuthenticated, withWorkspace);

const read = requirePermission("tx:read");
const write = requirePermission("tx:write");

transactionRouter.post("/create", write, transactionController.create);
transactionRouter.get("/lists", read, transactionController.getFilteredTransactions);
transactionRouter.get("/period", read, transactionController.getByPeriod);
transactionRouter.get("/balance", read, transactionController.getBalance);
transactionRouter.get(
  "/summary/monthly",
  read,
  transactionController.getMonthlySummary
);
transactionRouter.get(
  "/export/excel",
  read,
  transactionController.generateExcelReport
);
transactionRouter.put(
  "/update/:id",
  validateObjectId(),
  write,
  transactionController.update
);
transactionRouter.post(
  "/:id/void",
  validateObjectId(),
  write,
  transactionController.void
);
transactionRouter.post(
  "/:id/restore",
  validateObjectId(),
  write,
  transactionController.restore
);
//! Compatibilidad: los clientes ya desplegados llaman a DELETE /delete/:id.
//! Ahora anula en vez de borrar.
transactionRouter.delete(
  "/delete/:id",
  validateObjectId(),
  write,
  transactionController.void
);
transactionRouter.delete(
  "/:id/purge",
  validateObjectId(),
  requirePermission("tx:purge"),
  transactionController.purge
);
//! Ruta con parámetro al final
transactionRouter.get("/:id", validateObjectId(), read, transactionController.getOne);

module.exports = transactionRouter;
