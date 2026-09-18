const { isProduction } = require("../config/env");

//! 404 para rutas de API no registradas
const notFound = (req, res, next) => {
  const error = new Error(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || "Error interno del servidor";

  //! ID de Mongo con formato inválido
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Identificador inválido";
  }

  //! Errores de validación de Mongoose
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  //! Índice único duplicado
  if (err.code === 11000) {
    statusCode = 409;
    const campo = Object.keys(err.keyValue || {}).join(", ");
    message = `Ya existe un registro con ese valor${campo ? ` (${campo})` : ""}`;
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Sesión inválida o expirada";
  }

  //! En producción nunca se devuelven detalles internos al cliente
  if (isProduction && statusCode === 500) {
    message = "Error interno del servidor";
    console.error("[error]", err);
  }

  res.status(statusCode).json({
    message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};

module.exports = errorHandler;
module.exports.notFound = notFound;
module.exports.errorHandler = errorHandler;
