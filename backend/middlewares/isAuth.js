const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../model/User");
const { JWT_SECRET } = require("../config/env");

//! Los tokens que trae la petición, en orden de preferencia: la cookie primero
//! (es httpOnly, no la puede leer un script) y el encabezado después, que es el
//! que usan los clientes que viven en otro dominio.
//!
//! El mismo token suele venir en los dos sitios: se prueba una sola vez.
const tokensOf = (req) => {
  const candidatos = [];

  if (req.cookies && req.cookies.token) candidatos.push(req.cookies.token);

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    candidatos.push(authHeader.split(" ")[1]);
  }

  return [...new Set(candidatos.filter(Boolean))];
};

//! Comprueba un token contra la base. Devuelve `{ user }` o `{ error }`: el
//! motivo por el que ese token no sirve, para poder responderlo si no sirve
//! ninguno.
const usuarioDe = async (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return {
      error: { message: "Sesión inválida o expirada", code: "INVALID_TOKEN" },
    };
  }

  //! Se lee el usuario real en cada request: así el rol nunca queda obsoleto
  //! y una cuenta eliminada deja de tener acceso inmediatamente.
  let user = null;
  try {
    user = await User.findById(decoded.id).select("-password");
  } catch (err) {
    //! Un "id" que no es un id (token viejo, o manipulado) no es un error del
    //! servidor: es un token que no sirve.
    user = null;
  }

  if (!user) {
    return {
      error: { message: "Sesión inválida o expirada", code: "INVALID_TOKEN" },
    };
  }

  //! Los tokens emitidos antes del último cambio de contraseña quedan
  //! invalidados. Los tokens anteriores a este campo no traen "v" y valen como
  //! versión 0, igual que los usuarios que nunca cambiaron la contraseña.
  if ((decoded.v || 0) !== (user.tokenVersion || 0)) {
    return {
      error: {
        message: "La contraseña cambió, inicia sesión de nuevo",
        code: "PASSWORD_CHANGED",
      },
    };
  }

  return { user };
};

const isAuthenticated = asyncHandler(async (req, res, next) => {
  const tokens = tokensOf(req);

  if (tokens.length === 0) {
    return res
      .status(401)
      .json({ message: "No autenticado", code: "NO_TOKEN" });
  }

  //! Se prueban en orden y vale el primero que sirva.
  //!
  //! Antes bastaba con que la cookie estuviera puesta: una cookie vieja tumbaba
  //! la petición aunque el token del encabezado fuera bueno. Pasó de verdad al
  //! migrar los datos, cuando cambiaron los identificadores de usuario y
  //! quedaron cookies apuntando a cuentas que ya no existían: la app mandaba un
  //! token nuevo y perfecto, y el servidor la echaba al login igual.
  //!
  //! El motivo que se responde es el del primer token que falló (la cookie, que
  //! es el camino principal): así, cuando no sirve ninguno, el mensaje sigue
  //! diciendo lo mismo que antes.
  let primeroQueFallo = null;

  for (const token of tokens) {
    const { user, error } = await usuarioDe(token);

    if (user) {
      req.user = user;
      return next();
    }

    if (!primeroQueFallo) primeroQueFallo = error;
  }

  return res.status(401).json(
    primeroQueFallo || {
      message: "Sesión inválida o expirada",
      code: "INVALID_TOKEN",
    }
  );
});

module.exports = isAuthenticated;
