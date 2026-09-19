const express = require("express");
const adminController = require("../controllers/adminController");
const isAuthenticated = require("../middlewares/isAuth");
const isAdmin = require("../middlewares/isAdmin");

const router = express.Router();

//! Todo el router exige sesión + rol admin de la plataforma
router.use(isAuthenticated, isAdmin);

router.get("/users", adminController.getAllUsers);
router.get("/workspaces", adminController.getAllWorkspaces);

module.exports = router;
