//! Genera los iconos de la PWA desde los SVG de public/:
//!   node scripts/generar-iconos.mjs
//!
//! - icon.svg (con esquinas redondeadas): favicon e iconos "any".
//! - icon-maskable.svg (a sangre): Android "maskable" y Apple, que recortan la
//!   forma ellos mismos. Con el redondeado quedaba un cuadrado dentro de otro.
//!
//! PNG sin paleta: comprimir a paleta rompía el degradado en manchas.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const src = (name) => path.join(publicDir, name);

const png = (input, size, output) =>
  sharp(src(input), { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9, palette: false })
    .toFile(src(output));

await Promise.all([
  png("icon.svg", 64, "pwa-64x64.png"),
  png("icon.svg", 192, "pwa-192x192.png"),
  png("icon.svg", 512, "pwa-512x512.png"),
  png("icon-maskable.svg", 512, "maskable-icon-512x512.png"),
  png("icon-maskable.svg", 180, "apple-touch-icon-180x180.png"),
]);

console.log("Iconos generados en public/");
