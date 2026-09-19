//! Genera los iconos de la PWA desde los SVG de public/:
//!   node scripts/generar-iconos.mjs
//!
//! - icon.svg (con esquinas redondeadas): favicon e iconos "any".
//! - icon-maskable.svg (a sangre): Android "maskable" y Apple, que recortan la
//!   forma ellos mismos. Con el redondeado quedaba un cuadrado dentro de otro.
//!
//! PNG sin paleta: comprimir a paleta rompía los degradados en manchas.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeFile } from "node:fs/promises";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const src = (name) => path.join(publicDir, name);

const png = (input, size, output) =>
  sharp(src(input), { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9, palette: false })
    .toFile(src(output));

//! favicon.ico de 48x48: un ICO puede llevar dentro un PNG tal cual (cabecera
//! de 6 bytes + una entrada de 16 que apunta a los datos)
const ico = async (input, size, output) => {
  const data = await sharp(src(input), { density: 384 }).resize(size, size).png().toBuffer();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: icono
  header.writeUInt16LE(1, 4); // una imagen
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt16LE(1, 10); // planos
  header.writeUInt16LE(32, 12); // bits por píxel
  header.writeUInt32LE(data.length, 14);
  header.writeUInt32LE(22, 18); // dónde empiezan los datos
  await writeFile(src(output), Buffer.concat([header, data]));
};

//! Los del APK (android/): mismos tamaños que generó Bubblewrap por densidad.
//! Después hay que compilar y firmar una versión nueva (android/README.md).
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const res = (folder, file) => path.join("..", "..", "android", "app", "src", "main", "res", folder, file);
const android = Object.entries(DENSITIES).flatMap(([name, x]) => [
  png("icon.svg", 48 * x, res(`mipmap-${name}`, "ic_launcher.png")),
  png("icon-maskable.svg", Math.round(82 * x), res(`mipmap-${name}`, "ic_maskable.png")),
  png("icon.svg", 48 * x, res(`drawable-${name}`, "shortcut_0.png")),
  png("icon.svg", 300 * x, res(`drawable-${name}`, "splash.png")),
]);

await Promise.all([
  png("icon.svg", 64, "pwa-64x64.png"),
  png("icon.svg", 192, "pwa-192x192.png"),
  png("icon.svg", 512, "pwa-512x512.png"),
  png("icon-maskable.svg", 512, "maskable-icon-512x512.png"),
  png("icon-maskable.svg", 180, "apple-touch-icon-180x180.png"),
  ico("icon.svg", 48, "favicon.ico"),
  ...android,
  png("icon.svg", 512, path.join("..", "..", "android", "store_icon.png")),
]);

console.log("Iconos generados en public/ y en android/");
