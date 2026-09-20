const multer = require("multer");
const { looksLike } = require("./receiptUpload");

//! Un logo es pequeño: esto cubre de sobra un PNG con transparencia
const MAX_BYTES = 2 * 1024 * 1024;

//! Solo JPG y PNG: son los únicos formatos que pdfkit sabe incrustar en el
//! PDF, y el logo existe precisamente para salir impreso en los informes.
const ALLOWED = ["image/jpeg", "image/png"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED.includes(file.mimetype)),
}).single("logo");

const logoUpload = (req, res, next) =>
  upload(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: "El logo no puede pasar de 2 MB" });
      }
      return res.status(400).json({ message: "No se pudo leer el archivo" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Elige una imagen PNG o JPG" });
    }
    if (!looksLike(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ message: "El archivo no es una imagen válida" });
    }
    next();
  });

module.exports = { logoUpload, MAX_BYTES };
