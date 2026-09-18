const express = require("express");
const adminController = require("../controllers/adminController");
const isAuthenticated = require("../middlewares/isAuth");
const isAdmin = require("../middlewares/isAdmin");
const validateObjectId = require("../middlewares/validateObjectId");

const router = express.Router();

//! Todo el router exige sesión + rol admin
router.use(isAuthenticated, isAdmin);

router.get("/users", adminController.getAllUsers);
router.get(
  "/dashboard/:id",
  validateObjectId(),
  adminController.getUserDashboard
);
router.put(
  "/categories/:categoryId",
  validateObjectId("categoryId"),
  adminController.updateUserCategory
);
router.delete(
  "/categories/:categoryId",
  validateObjectId("categoryId"),
  adminController.deleteUserCategory
);
router.put(
  "/transactions/:id",
  validateObjectId(),
  adminController.updateUserTransaction
);
router.delete(
  "/transactions/:id",
  validateObjectId(),
  adminController.deleteUserTransaction
);

module.exports = router;
