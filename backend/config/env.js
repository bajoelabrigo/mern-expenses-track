const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";
const isTest = NODE_ENV === "test";

//! Variables obligatorias: si falta alguna el proceso no debe arrancar
const required = ["MONGO_URL", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0 && !isTest) {
  throw new Error(
    `Faltan variables de entorno obligatorias: ${missing.join(
      ", "
    )}. Revisa el archivo .env (puedes partir de .env.example).`
  );
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32 && !isTest) {
  throw new Error(
    "JWT_SECRET debe tener al menos 32 caracteres. Genera uno con: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
  );
}

//! Orígenes permitidos por CORS (separados por coma en la variable CORS_ORIGINS)
const corsOrigins = (
  process.env.CORS_ORIGINS ||
  "http://localhost:5173,http://localhost:4173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  NODE_ENV,
  isProduction,
  isTest,
  PORT: Number(process.env.PORT) || 8000,
  MONGO_URL: process.env.MONGO_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  COOKIE_MAX_AGE_MS: Number(process.env.COOKIE_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000,
  CORS_ORIGINS: corsOrigins,
  //! Cross-site (frontend y API en dominios distintos) exige SameSite=None + Secure
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE || (isProduction ? "none" : "lax"),
  SERVE_FRONTEND: process.env.SERVE_FRONTEND === "true",
  MIN_PASSWORD_LENGTH: 8,
};
