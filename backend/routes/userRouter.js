const express = require("express");
const usersController = require("../controllers/userController");
const isAuthenticated = require("../middlewares/isAuth");
const { authLimiter } = require("../middlewares/rateLimiters");

const userRouter = express.Router();

//! Rutas públicas con límite de intentos (anti fuerza bruta)
userRouter.post("/register", authLimiter, usersController.register);
userRouter.post("/login", authLimiter, usersController.login);
userRouter.post("/logout", usersController.logout);

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

module.exports = userRouter;
