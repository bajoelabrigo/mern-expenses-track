const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

//! Limpia los errores típicos al pegar variables en un panel de hosting:
//! espacios sobrantes, comillas alrededor del valor y el nombre de la variable
//! pegado por delante ("MONGO_URL=mongodb+srv://...").
const limpiar = (nombre, valor) => {
  if (typeof valor !== "string") return valor;

  let limpio = valor.trim();

  const conNombre = new RegExp(`^${nombre}\\s*=\\s*`);
  if (conNombre.test(limpio)) {
    limpio = limpio.replace(conNombre, "").trim();
  }

  if (
    limpio.length > 1 &&
    ((limpio.startsWith('"') && limpio.endsWith('"')) ||
      (limpio.startsWith("'") && limpio.endsWith("'")))
  ) {
    limpio = limpio.slice(1, -1).trim();
  }

  return limpio;
};

const leer = (nombre) => limpiar(nombre, process.env[nombre]);

const NODE_ENV = leer("NODE_ENV") || "development";
const isProduction = NODE_ENV === "production";
const isTest = NODE_ENV === "test";

//! Variables obligatorias: si falta alguna el proceso no debe arrancar
const required = ["MONGO_URL", "JWT_SECRET"];
const missing = required.filter((key) => !leer(key));

if (missing.length > 0 && !isTest) {
  throw new Error(
    `Faltan variables de entorno obligatorias: ${missing.join(
      ", "
    )}. Revisa el archivo .env (puedes partir de .env.example).`
  );
}

const MONGO_URL = leer("MONGO_URL");

//! Se valida el formato aquí para dar un mensaje útil antes de intentar conectar.
//! Nunca se imprime la cadena completa: solo cómo empieza.
if (
  MONGO_URL &&
  !/^mongodb(\+srv)?:\/\//.test(MONGO_URL) &&
  !isTest
) {
  throw new Error(
    `MONGO_URL debe empezar por "mongodb://" o "mongodb+srv://" y empieza por "${MONGO_URL.slice(
      0,
      12
    )}...". Al copiarla en el panel de hosting pega solo el valor, sin el nombre de la variable ni comillas.`
  );
}

const JWT_SECRET = leer("JWT_SECRET");

if (JWT_SECRET && JWT_SECRET.length < 32 && !isTest) {
  throw new Error(
    "JWT_SECRET debe tener al menos 32 caracteres. Genera uno con: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
  );
}

//! Orígenes permitidos por CORS (separados por coma en la variable CORS_ORIGINS)
const corsOrigins = (
  leer("CORS_ORIGINS") || "http://localhost:5173,http://localhost:4173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  //! Expuesto para las pruebas
  limpiar,
  NODE_ENV,
  isProduction,
  isTest,
  PORT: Number(leer("PORT")) || 8000,
  MONGO_URL,
  JWT_SECRET,
  JWT_EXPIRES_IN: leer("JWT_EXPIRES_IN") || "7d",
  COOKIE_MAX_AGE_MS:
    Number(leer("COOKIE_MAX_AGE_MS")) || 7 * 24 * 60 * 60 * 1000,
  CORS_ORIGINS: corsOrigins,
  //! Cross-site (frontend y API en dominios distintos) exige SameSite=None + Secure
  COOKIE_SAMESITE: leer("COOKIE_SAMESITE") || (isProduction ? "none" : "lax"),
  SERVE_FRONTEND: leer("SERVE_FRONTEND") === "true",
  MIN_PASSWORD_LENGTH: 8,
  //! URL pública del frontend: los enlaces de los correos (invitaciones,
  //! recuperar contraseña) apuntan aquí. Sin barra final.
  APP_URL: (leer("APP_URL") || corsOrigins[0] || "http://localhost:5173").replace(
    /\/+$/,
    ""
  ),
  //! Correo saliente. BREVO_API_KEY (API HTTP) tiene prioridad sobre SMTP: el
  //! plan gratuito de Render bloquea los puertos SMTP. Sin ninguno, los correos
  //! no se envían y el enlace se escribe en el log del servidor.
  BREVO_API_KEY: leer("BREVO_API_KEY") || "",
  //! Comprobantes: Cloudinary con entrega AUTENTICADA (nunca públicos). Sin
  //! estas variables la subida de comprobantes responde 503.
  CLOUDINARY_CLOUD_NAME: leer("CLOUDINARY_CLOUD_NAME") || "",
  CLOUDINARY_API_KEY: leer("CLOUDINARY_API_KEY") || "",
  CLOUDINARY_API_SECRET: leer("CLOUDINARY_API_SECRET") || "",
  SMTP_HOST: leer("SMTP_HOST") || "",
  SMTP_PORT: Number(leer("SMTP_PORT")) || 587,
  SMTP_USER: leer("SMTP_USER") || "",
  SMTP_PASS: leer("SMTP_PASS") || "",
  MAIL_FROM: leer("MAIL_FROM") || leer("SMTP_USER") || "",
};
