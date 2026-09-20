const cloudinary = require("cloudinary").v2;
const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = require("../config/env");

//! El logo de la iglesia, al revés que los comprobantes, es PÚBLICO: va
//! impreso en informes que se reparten y se pega en el mural. Por eso se sube
//! con entrega normal ("upload") y su URL funciona sola.

const FOLDER = "control-gastos/logos";
//! Se guarda reducido: en la hoja se imprime a unos 2 cm
const MAX_SIDE = 600;

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

//! Sube el logo de un espacio. Un espacio tiene un solo logo, así que se
//! guarda con un id fijo y el nuevo reemplaza al anterior.
const upload = ({ buffer, workspaceId }) =>
  new Promise((resolve, reject) => {
    const stream = client().uploader.upload_stream(
      {
        public_id: `${FOLDER}/${workspaceId}`,
        overwrite: true,
        invalidate: true,
        resource_type: "image",
        //! A PNG siempre: pdfkit solo sabe incrustar PNG y JPEG, y el PNG
        //! conserva el fondo transparente de la mayoría de los logos
        format: "png",
        transformation: [{ width: MAX_SIDE, height: MAX_SIDE, crop: "limit" }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          publicId: result.public_id,
          //! Con la versión dentro, la URL cambia al cambiar el logo y ningún
          //! navegador se queda con el viejo en su caché
          url: result.secure_url,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
        });
      }
    );
    stream.end(buffer);
  });

const destroy = ({ publicId }) =>
  client().uploader.destroy(publicId, { resource_type: "image", invalidate: true });

//! Los bytes del logo, para incrustarlo en un PDF
const fetchBytes = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo bajar el logo (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
};

//! Implementación activa; las pruebas la sustituyen para no tocar Cloudinary
let impl = { isConfigured, upload, destroy, fetchBytes };

const logoStorage = new Proxy({}, { get: (target, prop) => impl[prop] });

const setLogoStorage = (replacement) => {
  impl = replacement;
  cache.clear();
};

//! El mismo logo se imprime en cada informe y cada constancia, así que se
//! guarda en memoria. La clave es la URL, que lleva la versión dentro: al
//! cambiar el logo cambia la URL y la copia vieja deja de usarse sola.
const cache = new Map();
const MAX_CACHED = 50;

//! Los bytes del logo de un espacio, o null si no tiene o no se pudo bajar.
//! Nunca lanza: un informe no puede quedarse sin salir por culpa del logo.
const logoBytesFor = async (workspace) => {
  const url = workspace?.logo?.url;
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);

  let bytes = null;
  try {
    bytes = await logoStorage.fetchBytes(url);
  } catch (err) {
    console.error("No se pudo bajar el logo para el PDF:", err.message);
    return null;
  }

  //! Un tope sencillo para que la memoria no crezca sin fin
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value);
  cache.set(url, bytes);
  return bytes;
};

module.exports = { logoStorage, setLogoStorage, logoBytesFor, MAX_SIDE };
