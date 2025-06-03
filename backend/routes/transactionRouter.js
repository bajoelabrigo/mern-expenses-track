const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const transactionController = require("../controllers/transactionController");

const transactionRouter = express.Router();

//! Crear transacción
transactionRouter.post(
  "/api/v1/transactions/create",
  isAuthenticated,
  transactionController.create
);

//! Obtener transacciones filtradas
transactionRouter.get(
  "/api/v1/transactions/lists",
  isAuthenticated,
  transactionController.getFilteredTransactions
);

//! Obtener transacciones por periodo (mensual, bimestral, etc)
transactionRouter.get(
  "/api/v1/transactions/period",
  isAuthenticated,
  transactionController.getByPeriod
);

//! Actualizar transacción
transactionRouter.put(
  "/api/v1/transactions/update/:id",
  isAuthenticated,
  transactionController.update
);

//! Eliminar transacción
transactionRouter.delete(
  "/api/v1/transactions/delete/:id",
  isAuthenticated,
  transactionController.delete
);

//! Resumen mensual de ingresos y gastos
transactionRouter.get(
  "/api/v1/transactions/summary/monthly",
  isAuthenticated,
  transactionController.getMonthlySummary
);

//! Balance general
transactionRouter.get(
  "/api/v1/transactions/balance",
  isAuthenticated,
  transactionController.getBalance
);

//! Exportar a Excel
transactionRouter.get(
  "/api/v1/transactions/export/excel",
  isAuthenticated,
  transactionController.generateExcelReport
);

transactionRouter.get(
  "/api/v1/transactions/:id",
  isAuthenticated,
  transactionController.getOne
);

module.exports = transactionRouter;
