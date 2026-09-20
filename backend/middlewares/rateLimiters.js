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

//! Acciones que envían un correo (recuperar contraseña, invitaciones). Cuenta
//! TODAS las peticiones, también las exitosas: "olvidé mi contraseña" responde
//! siempre 200 y, sin este límite, serviría para inundar un buzón ajeno.
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    message: "Demasiados correos solicitados. Vuelve a intentarlo en 15 minutos.",
  },
});

//! El resumen público de una iglesia: no lleva sesión, así que es lo único
//! que cualquiera puede pedir desde fuera. El límite corta el raspado y
//! cualquier intento de adivinar enlaces a fuerza bruta.
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    message: "Demasiadas peticiones. Espera un momento e inténtalo de nuevo.",
  },
});

module.exports = { authLimiter, apiLimiter, emailLimiter, publicLimiter };
