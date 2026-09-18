const mongoose = require("mongoose");

//! Valida que el parámetro de la URL sea un ObjectId real antes de tocar la BD.
const validateObjectId =
  (paramName = "id") =>
  (req, res, next) => {
    const value = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({ message: "Identificador inválido" });
    }
    next();
  };

module.exports = validateObjectId;
