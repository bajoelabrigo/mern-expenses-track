const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const validateObjectId = require("../middlewares/validateObjectId");
const transactionController = require("../controllers/transactionController");

const transactionRouter = express.Router();

//! Todas las rutas de transacciones requieren sesión
transactionRouter.use(isAuthenticated);

transactionRouter.post("/create", transactionController.create);
transactionRouter.get("/lists", transactionController.getFilteredTransactions);
transactionRouter.get("/period", transactionController.getByPeriod);
transactionRouter.get("/balance", transactionController.getBalance);
transactionRouter.get(
  "/summary/monthly",
  transactionController.getMonthlySummary
);
transactionRouter.get(
  "/export/excel",
  transactionController.generateExcelReport
);
transactionRouter.put(
  "/update/:id",
  validateObjectId(),
  transactionController.update
);
transactionRouter.delete(
  "/delete/:id",
  validateObjectId(),
  transactionController.delete
);
//! Ruta con parámetro al final
transactionRouter.get("/:id", validateObjectId(), transactionController.getOne);

module.exports = transactionRouter;
