const jwt = require("jsonwebtoken");

const isAuthenticated = async (req, res, next) => {
  try {
    let token = req.cookies.token;

    // Si no hay cookie, intenta extraer el token desde Authorization header
    if (
      !token &&
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, "masynctechKey");
    req.user = {
      _id: decoded.id,
      role: decoded.role, // ← Incluye el rol si está en el token
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Token expired, login again" });
  }
};

module.exports = isAuthenticated;
