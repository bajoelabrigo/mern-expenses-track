const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");

const { notFound, errorHandler } = require("./middlewares/errorHandlerMiddleware");
const { apiLimiter } = require("./middlewares/rateLimiters");
const userRouter = require("./routes/userRouter");
const categoryRouter = require("./routes/categoryRouter");
const transactionRouter = require("./routes/transactionRouter");
const adminRouter = require("./routes/adminRoutes");
const workspaceRouter = require("./routes/workspaceRouter");
const invitationRouter = require("./routes/invitationRouter");
const { CORS_ORIGINS, SERVE_FRONTEND, isProduction } = require("./config/env");

const app = express();

//! Detrás de Render/Netlify/Nginx hace falta confiar en el proxy para que
//! el rate limit y las cookies "secure" funcionen con la IP real.
app.set("trust proxy", 1);

//! Cabeceras de seguridad
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

//! CORS: orígenes definidos por variable de entorno
const corsOptions = {
  origin: (origin, callback) => {
    //! Permite herramientas sin origin (curl, health checks) y los orígenes listados
    if (!origin || CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    //! Origen no permitido: se responde sin cabeceras CORS (el navegador bloquea
    //! la respuesta). Lanzar un error aquí convertía la petición en un 500.
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Workspace-Id"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

//! Parsers con límite de tamaño
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));
app.use(cookieParser());

//! Elimina operadores de Mongo ($, .) del input del usuario
app.use(mongoSanitize());

//! Health check para el hosting
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

//! Rutas de la API
app.use("/api/v1", apiLimiter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/transactions", transactionRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/workspaces", workspaceRouter);
app.use("/api/v1/invitations", invitationRouter);

//! Servir el frontend compilado solo si se activa explícitamente
if (SERVE_FRONTEND) {
  const distPath = path.join(__dirname, "..", "frontend", "dist");
  app.use(express.static(distPath));

  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else if (!isProduction) {
  app.get("/", (req, res) => {
    res.json({ message: "API del sistema contable. Endpoints bajo /api/v1" });
  });
}

//! 404 + manejador central de errores (siempre al final)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
