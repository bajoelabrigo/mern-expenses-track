//! Reduce una foto antes de subirla: una foto de móvil de 4 MB queda en unos
//! 300 KB, que se sube bien con datos móviles y se lee igual.
const MAX_SIDE = 1600;
const QUALITY = 0.8;

export const compressImage = async (file) => {
  //! PDF y lo que no sea imagen se sube tal cual
  if (!file?.type?.startsWith("image/")) return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    //! El navegador no sabe decodificarla (p. ej. HEIC fuera de Safari): se
    //! sube la original, el servidor la acepta
    return file;
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  //! Si no mejora (ya era pequeña), se queda la original
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
};

export const RECEIPT_ACCEPT = "image/*,application/pdf";
export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;
