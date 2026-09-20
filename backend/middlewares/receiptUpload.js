const multer = require("multer");

//! Tope por comprobante. El frontend reduce las fotos a ~300 KB; esto cubre un
//! PDF escaneado o una foto que llegue sin reducir.
const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

//! Firma de los primeros bytes: el tipo que declara el navegador se puede
//! falsificar, el contenido no tanto.
const looksLike = (buffer, mimetype) => {
  const b = buffer.subarray(0, 12);
  const ascii = (from, to) => b.subarray(from, to).toString("latin1");
  switch (mimetype) {
    case "image/jpeg":
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/png":
      return b[0] === 0x89 && ascii(1, 4) === "PNG";
    case "image/webp":
      return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    case "image/heic":
    case "image/heif":
      return ascii(4, 8) === "ftyp";
    case "application/pdf":
      return ascii(0, 5) === "%PDF-";
    default:
      return false;
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED.includes(file.mimetype)),
}).single("receipt");

//! Recibe el archivo del campo "receipt" y lo valida; los errores de multer se
//! traducen a respuestas claras en vez de un 500.
const receiptUpload = (req, res, next) =>
  upload(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: "El comprobante no puede pasar de 8 MB" });
      }
      return res.status(400).json({ message: "No se pudo leer el archivo" });
    }
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Adjunta una foto (JPG, PNG, WEBP, HEIC) o un PDF" });
    }
    if (!looksLike(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ message: "El archivo no es una imagen o un PDF válido" });
    }
    next();
  });

//! `looksLike` lo reusa la subida del logo: el tipo que declara el navegador
//! se puede falsificar en cualquier formulario, no solo en el de comprobantes.
module.exports = { receiptUpload, MAX_BYTES, looksLike };
