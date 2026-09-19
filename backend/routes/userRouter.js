const express = require("express");
const usersController = require("../controllers/userController");
const isAuthenticated = require("../middlewares/isAuth");
const { authLimiter, emailLimiter } = require("../middlewares/rateLimiters");

const userRouter = express.Router();

//! Rutas públicas con límite de intentos (anti fuerza bruta)
userRouter.post("/register", authLimiter, usersController.register);
userRouter.post("/login", authLimiter, usersController.login);
userRouter.post("/logout", usersController.logout);
userRouter.post("/forgot-password", emailLimiter, usersController.forgotPassword);
userRouter.post(
  "/reset-password/:token",
  authLimiter,
  usersController.resetPassword
);

//! Rutas protegidas
userRouter.get("/profile", isAuthenticated, usersController.profile);
userRouter.put(
  "/change-password",
  isAuthenticated,
  authLimiter,
  usersController.changeUserPassword
);
userRouter.put(
  "/update-profile",
  isAuthenticated,
  usersController.updateUserProfile
);
userRouter.put(
  "/default-workspace",
  isAuthenticated,
  usersController.setDefaultWorkspace
);

module.exports = userRouter;
