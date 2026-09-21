//! Genera los iconos de la app (web, PWA y APK) desde el logo maestro:
//!   node scripts/generar-iconos.mjs
//!
//! El maestro es `scripts/icono-fuente.png`, un cuadrado con margen blanco y
//! esquinas redondeadas. Vive FUERA de `public/` a propósito: es la fuente
//! (1,3 MB) y no tiene por qué viajar al móvil de nadie. Lo que se publica son
//! los derivados, que pesan unos pocos KB.
//!
//! De ahí salen dos familias:
//! - **Redondos** (`icon.svg` de antes): el logo recortado, con las esquinas
//!   redondeadas y transparentes. Van al favicon, a los iconos "any" de la PWA
//!   y a `ic_launcher` del APK.
//! - **A sangre**: un cuadrado completo, sin transparencia, para lo que el
//!   sistema recorta él mismo — el icono "maskable" de Android y el de iOS. Si
//!   se les diera el redondo, quedaría un cuadrado dentro de otro. Llevan un
//!   fondo suave sacado del propio logo y el logo al 82 %, dentro de la zona
//!   segura que Android respeta al recortar.
//!
//! PNG con paleta: ver la constante PNG más abajo.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeFile } from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "..", "public");
const master = path.join(here, "icono-fuente.png");
const pub = (name) => path.join(publicDir, name);
const res = (folder, file) =>
  path.join(here, "..", "..", "android", "app", "src", "main", "res", folder, file);

//! PNG con paleta (256 colores y tramado). El maestro es un logo ilustrado, no
//! una foto: sin paleta el icono de 512 px pesaba 470 KB y con ella 80 KB, y a
//! ojo —a 512 y a 64 px— el degradado azul no se corta en escalones.
const PNG = { compressionLevel: 9, palette: true, dither: 1, effort: 10 };

//! ── Medir el maestro una sola vez ──
//! El logo no viene a sangre: hay margen blanco alrededor y las esquinas están
//! redondeadas. Se busca la caja del contenido y el radio de la esquina (así el
//! recorte sigue funcionando si algún día cambian el logo por otro parecido).
const medir = async () => {
  const { data, info } = await sharp(master).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const blanco = (x, y) => {
    const i = (y * W + x) * C;
    return data[i] > 244 && data[i + 1] > 244 && data[i + 2] > 244;
  };

  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (blanco(x, y)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  //! Cuadrado centrado en el contenido: el maestro no es exacto al píxel y
  //! estirarlo dejaría el logo deformado.
  const lado = Math.min(maxX - minX + 1, maxY - minY + 1);
  const left = Math.round(minX + (maxX - minX + 1 - lado) / 2);
  const top = Math.round(minY + (maxY - minY + 1 - lado) / 2);

  //! Radio de la esquina: desde muy cerca del vértice, cuántos píxeles tarda la
  //! fila (y la columna) en encontrar el contenido.
  const d = 2;
  let x = left + d;
  while (x < left + lado && blanco(x, top + d)) x++;
  let y = top + d;
  while (y < top + lado && blanco(left + d, y)) y++;
  let radio = Math.max(x - left - d, y - top - d);
  //! Un logo cuadrado sin redondear daría un radio enorme (media caja): se
  //! limita a algo razonable, que es lo que se ve en el maestro.
  radio = Math.min(radio, Math.round(lado * 0.3)) || Math.round(lado * 0.2);

  return { left, top, lado, radio };
};

const caja = await medir();
console.log(
  `Maestro: ${caja.lado} px de lado, esquinas de ${caja.radio} px (${Math.round((caja.radio / caja.lado) * 100)} %)`
);

//! El logo recortado al cuadrado, del tamaño que se pida
const logo = (size) =>
  sharp(master).extract({ left: caja.left, top: caja.top, width: caja.lado, height: caja.lado }).resize(size, size);

//! Máscara de esquinas redondeadas, en el mismo tamaño
const mascara = (size) => {
  const r = Math.round((caja.radio / caja.lado) * size);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
};

//! Icono redondo: esquinas transparentes, para que se vea el fondo que ponga
//! quien lo muestre.
const redondo = async (size, output) => {
  const recorte = await logo(size).png().toBuffer();
  await sharp(recorte)
    .composite([{ input: mascara(size), blend: "dest-in" }])
    .png(PNG)
    .toFile(output);
};

//! Icono a sangre: el sistema lo recorta él mismo, así que no puede tener ni
//! transparencia ni esquinas propias.
//!
//! El fondo es un degradado radial con los colores que el logo tiene justo al
//! otro lado de su esquina redondeada (azul claro arriba, azul oscuro en las
//! esquinas), medidos sobre el maestro. El logo va encima, recortado por la
//! máscara redonda para que sus esquinas blancas dejen ver el degradado.
//!
//! Tres caminos probados y descartados antes: desenfocar el logo tal cual
//! (salía un halo claro, porque el blanco de la iglesia se mezclaba), recortar
//! el 10 % de cada lado (cortaba el borde del recibo y dejaba blancas las
//! esquinas) y ampliarlo 1,4 veces como fondo (las esquinas salían grises, del
//! blanco que entra en el encuadre).
const CLARO = "#0988fa";
const MEDIO = "#0056cc";
const OSCURO = "#001458";

const aSangre = async (size, output) => {
  const fondo = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<defs><radialGradient id="g" cx="50%" cy="0%" r="112%">` +
      `<stop offset="0%" stop-color="${CLARO}"/>` +
      `<stop offset="45%" stop-color="${MEDIO}"/>` +
      `<stop offset="100%" stop-color="${OSCURO}"/>` +
      `</radialGradient></defs>` +
      `<rect width="${size}" height="${size}" fill="url(#g)"/></svg>`
  );

  //! El logo al 80 %: la ilustración del maestro llega casi al borde de su
  //! cuadrado, así que a tamaño completo el recorte del sistema le comería el
  //! borde del recibo y la punta del libro. Al 80 % el contenido cae dentro de
  //! la zona segura y el resto lo cubre el degradado.
  const interior = Math.round(size * 0.8);
  const encima = await sharp(await logo(interior).png().toBuffer())
    .composite([{ input: mascara(interior), blend: "dest-in" }])
    .png()
    .toBuffer();

  await sharp(fondo)
    .composite([{ input: encima, gravity: "center" }])
    .png(PNG)
    .toFile(output);
};

//! favicon.ico de 48x48: un ICO puede llevar dentro un PNG tal cual (cabecera
//! de 6 bytes + una entrada de 16 que apunta a los datos)
const ico = async (size, output) => {
  const recorte = await logo(size).png().toBuffer();
  const data = await sharp(recorte)
    .composite([{ input: mascara(size), blend: "dest-in" }])
    .png()
    .toBuffer();
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
  await writeFile(output, Buffer.concat([header, data]));
};

//! Los del APK (android/): mismos tamaños que generó Bubblewrap por densidad.
//! Después hay que compilar y firmar una versión nueva (android/README.md).
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const android = Object.entries(DENSITIES).flatMap(([name, x]) => [
  redondo(48 * x, res(`mipmap-${name}`, "ic_launcher.png")),
  aSangre(Math.round(82 * x), res(`mipmap-${name}`, "ic_maskable.png")),
  redondo(48 * x, res(`drawable-${name}`, "shortcut_0.png")),
  //! La pantalla de carga del APK: el logo redondo sobre el fondo oscuro del
  //! tema, así que aquí sí conviene la transparencia
  redondo(300 * x, res(`drawable-${name}`, "splash.png")),
]);

await Promise.all([
  redondo(64, pub("pwa-64x64.png")),
  redondo(192, pub("pwa-192x192.png")),
  redondo(512, pub("pwa-512x512.png")),
  aSangre(512, pub("maskable-icon-512x512.png")),
  aSangre(180, pub("apple-touch-icon-180x180.png")),
  ico(48, pub("favicon.ico")),
  ...android,
  redondo(512, path.join(here, "..", "..", "android", "store_icon.png")),
]);

console.log("Iconos generados en public/ y en android/");
