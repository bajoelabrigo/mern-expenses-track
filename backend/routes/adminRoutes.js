const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const isAuthenticated = require("../middlewares/isAuth");
const isAdmin = require("../middlewares/isAdmin");

// Middleware para proteger todas las rutas de admin
router.use(isAuthenticated, isAdmin);

// 📌 Listar todos los usuarios
router.get("/users", adminController.getAllUsers);

// 📌 Ver dashboard (categorías y transacciones) de un usuario específico
router.get("/dashboard/:id", adminController.getUserDashboard);

// 📌 Editar categoría de otro usuario
router.put("/categories/:categoryId", adminController.updateUserCategory);

// 📌 Eliminar categoría de otro usuario
router.delete("/categories/:categoryId", adminController.deleteUserCategory);

// 📌 Editar transacción de otro usuario
router.put("/transactions/:id", adminController.updateUserTransaction);

// 📌 Eliminar transacción de otro usuario
router.delete("/transactions/:id", adminController.deleteUserTransaction);

module.exports = router;
