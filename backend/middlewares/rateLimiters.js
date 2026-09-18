const rateLimit = require("express-rate-limit");
const { isTest } = require("../config/env");

//! En tests los límites se desactivan para no falsear los casos
const skip = () => isTest;

//! Límite estricto para login / registro / cambio de contraseña
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip,
  message: {
    message: "Demasiados intentos. Vuelve a intentarlo en 15 minutos.",
  },
});

//! Límite general de la API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    message: "Demasiadas peticiones. Espera un momento e inténtalo de nuevo.",
  },
});

module.exports = { authLimiter, apiLimiter };
