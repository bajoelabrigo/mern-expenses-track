const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../model/User");
const { JWT_SECRET } = require("../config/env");

//! Extrae el token de la cookie httpOnly o del header Authorization: Bearer
const extractToken = (req) => {
  if (req.cookies && req.cookies.token) return req.cookies.token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return null;
};

const isAuthenticated = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res
      .status(401)
      .json({ message: "No autenticado", code: "NO_TOKEN" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Sesión inválida o expirada", code: "INVALID_TOKEN" });
  }

  //! Se lee el usuario real en cada request: así el rol nunca queda obsoleto
  //! y una cuenta eliminada deja de tener acceso inmediatamente.
  const user = await User.findById(decoded.id).select("-password");

  if (!user) {
    return res
      .status(401)
      .json({ message: "Sesión inválida o expirada", code: "INVALID_TOKEN" });
  }

  //! Los tokens emitidos antes del último cambio de contraseña quedan invalidados.
  //! iat viene en segundos, así que se compara en milisegundos.
  if (user.passwordChangedAt && decoded.iat) {
    if (decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
      return res.status(401).json({
        message: "La contraseña cambió, inicia sesión de nuevo",
        code: "PASSWORD_CHANGED",
      });
    }
  }

  req.user = user;
  next();
});

module.exports = isAuthenticated;
