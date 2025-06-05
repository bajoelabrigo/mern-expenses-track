const jwt = require("jsonwebtoken");

const isAuthenticated = async (req, res, next) => {
  try {
    let token = req.cookies.token;

    // Si no hay token en cookies, revisa el header Authorization: Bearer token
    if (
      !token &&
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Usa JWT_SECRET desde variables de entorno
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Adjunta al request el id y el rol si existe
    req.user = {
      _id: decoded.id,
      role: decoded.role || "user",
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Token expired or invalid" });
  }
};

module.exports = isAuthenticated;
