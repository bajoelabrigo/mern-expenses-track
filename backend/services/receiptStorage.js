const cloudinary = require("cloudinary").v2;
const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = require("../config/env");

//! Comprobantes en Cloudinary con entrega "authenticated": la URL normal del
//! archivo no funciona; solo se ve con un enlace firmado que genera la API
//! tras comprobar que quien lo pide es miembro del espacio, y que caduca.

const ROOT_FOLDER = "control-gastos";
//! Cuánto vale el enlace para ver un comprobante
const VIEW_URL_TTL_SECONDS = 5 * 60;

const isConfigured = () =>
  Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);

let configured = false;
const client = () => {
  if (!configured) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
};

const folderFor = (workspaceId) => `${ROOT_FOLDER}/${workspaceId}`;

//! Los PDF van como "raw" (Cloudinary los trataría como imagen y los podría
//! transformar); las fotos, como "image".
const resourceTypeFor = (mimetype) => (mimetype === "application/pdf" ? "raw" : "image");

//! Sube un archivo (buffer) y devuelve los datos que se guardan en el movimiento
const upload = ({ buffer, mimetype, workspaceId }) =>
  new Promise((resolve, reject) => {
    const resourceType = resourceTypeFor(mimetype);
    const stream = client().uploader.upload_stream(
      {
        folder: folderFor(workspaceId),
        type: "authenticated",
        resource_type: resourceType,
        ...(resourceType === "raw" ? { format: "pdf" } : {}),
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          publicId: result.public_id,
          resourceType,
          format: result.format || (resourceType === "raw" ? "pdf" : ""),
          bytes: result.bytes,
        });
      }
    );
    stream.end(buffer);
  });

//! Enlace temporal para ver el comprobante
const viewUrl = ({ publicId, resourceType, format }) =>
  client().utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + VIEW_URL_TTL_SECONDS,
    attachment: false,
  });

const destroy = ({ publicId, resourceType }) =>
  client().uploader.destroy(publicId, {
    resource_type: resourceType,
    type: "authenticated",
    invalidate: true,
  });

//! Todos los comprobantes de un espacio (al borrar el espacio)
const destroyWorkspace = async (workspaceId) => {
  const prefix = `${folderFor(workspaceId)}/`;
  for (const resourceType of ["image", "raw"]) {
    await client().api.delete_resources_by_prefix(prefix, {
      resource_type: resourceType,
      type: "authenticated",
    });
  }
};

//! Implementación activa; las pruebas la sustituyen con setReceiptStorage para
//! no tocar Cloudinary.
let impl = { isConfigured, upload, viewUrl, destroy, destroyWorkspace };

const receiptStorage = new Proxy(
  {},
  { get: (target, prop) => impl[prop] }
);

const setReceiptStorage = (replacement) => {
  impl = replacement;
};

module.exports = { receiptStorage, setReceiptStorage, VIEW_URL_TTL_SECONDS };
