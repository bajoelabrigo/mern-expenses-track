const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const { authLimiter } = require("../middlewares/rateLimiters");
const ctrl = require("../controllers/workspaceController");

const router = express.Router();

//! Ver la invitación no exige sesión: quien la recibe puede no tener cuenta.
//! Con límite de intentos para que no se puedan adivinar tokens a fuerza bruta.
router.get("/:token", authLimiter, ctrl.previewInvitation);
router.post("/:token/accept", isAuthenticated, ctrl.acceptInvitation);

module.exports = router;
