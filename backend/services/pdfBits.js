//! Piezas comunes de los documentos en PDF (constancias, informes): los
//! colores de la app, el encabezado con el nombre de la iglesia, las filas de
//! dos columnas y la línea de firma. Así todos los papeles que entrega la
//! tesorería se ven iguales.

const { formatMoney } = require("../utils/money");

const INK = "#1f1405";
const MUTED = "#6b6862";
const LINE = "#d9d6cf";

const money = (amount, currency) => formatMoney(amount, currency);

const longDate = (date) =>
  date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

//! "12 sept" para las listas largas, donde el año ya está en el encabezado
const shortDate = (date) => date.toLocaleDateString("es", { day: "numeric", month: "short" });

//! Las categorías se guardan en minúscula; en un documento van con mayúscula
//! inicial, como se ven en la app
const capitalize = (text) => {
  const value = String(text || "").trim();
  return value ? value[0].toUpperCase() + value.slice(1) : "";
};

const contentWidth = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;

//! ¿Cabe algo de `needed` de alto en lo que queda de hoja? Si no, pasa de
//! página. pdfkit solo salta solo cuando escribe "en flujo"; como las filas
//! ponen el texto en una posición exacta (para alinear el monto a la derecha),
//! el salto hay que pedirlo a mano o la fila se parte entre dos hojas.
const ensureRoom = (doc, needed = 24) => {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) doc.addPage();
};

//! Una regla horizontal a la altura actual
const rule = (doc, y = doc.y) => {
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor(LINE)
    .lineWidth(0.5)
    .stroke();
};

//! Una fila de dos columnas (concepto a la izquierda, monto a la derecha).
//! `note` es un texto gris que va debajo del concepto (la categoría, quién dio).
const row = (doc, label, value, { bold = false, top = false, note = "" } = {}) => {
  ensureRoom(doc, note ? 34 : 22);
  const y = doc.y;
  if (top) rule(doc, y - 4);

  const width = contentWidth(doc);
  //! El concepto no puede invadir la columna del monto
  const labelWidth = width * 0.68;

  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(11).fillColor(INK);
  doc.text(label, doc.page.margins.left, y, { width: labelWidth, lineBreak: false, ellipsis: true });
  doc.text(value, doc.page.margins.left, y, { width, align: "right" });

  if (note) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    doc.text(note, doc.page.margins.left, doc.y, { width: labelWidth, lineBreak: false, ellipsis: true });
  }
  doc.moveDown(0.6);
};

//! Una fila de tabla: el concepto a la izquierda y varias cifras a la derecha,
//! en columnas del mismo ancho. Para la tabla mes a mes del informe anual.
const tableRow = (doc, label, values, { bold = false, top = false, muted = false } = {}) => {
  ensureRoom(doc, 20);
  const y = doc.y;
  if (top) rule(doc, y - 4);

  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const colWidth = (width * 0.62) / values.length;
  const labelWidth = width - colWidth * values.length - 8;

  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor(muted ? MUTED : INK);
  doc.text(label, left, y, { width: labelWidth, lineBreak: false, ellipsis: true });
  values.forEach((value, i) => {
    doc.text(String(value), left + labelWidth + 8 + colWidth * i, y, {
      width: colWidth,
      align: "right",
      lineBreak: false,
    });
  });
  doc.moveDown(0.55);
};

//! Alto del logo impreso, en puntos (unos 2 cm)
const LOGO_HEIGHT = 56;

//! Encabezado: el logo si lo hay, el nombre de la iglesia, de qué es el papel
//! y su título. `logo` son los bytes ya descargados (PNG o JPEG).
const header = (doc, { churchName, kind, title, logo }) => {
  if (logo) {
    try {
      //! `fit` respeta la proporción sea cual sea la forma del logo, y con
      //! `align` queda centrado aunque sea más ancho que alto
      doc.image(logo, doc.page.margins.left, doc.y, {
        fit: [contentWidth(doc), LOGO_HEIGHT],
        align: "center",
      });
      doc.y += LOGO_HEIGHT + 10;
    } catch {
      //! Un logo ilegible no puede impedir que salga el informe
    }
  }
  doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text(churchName, { align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(kind, { align: "center" });
  doc.moveDown(1.5);
  doc.font("Helvetica-Bold").fontSize(14).fillColor(INK).text(title, { align: "center" });
  doc.moveDown(1.5);
};

//! Título de una sección de la hoja
const section = (doc, text) => {
  //! Un título solo al pie de la hoja, con su lista en la siguiente, se lee fatal
  ensureRoom(doc, 60);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(text, doc.page.margins.left, doc.y);
  doc.moveDown(0.5);
};

//! Un párrafo pequeño en gris (avisos, notas al pie)
const note = (doc, text, options = {}) => {
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  doc.text(text, doc.page.margins.left, doc.y, { width: contentWidth(doc), align: "justify", ...options });
};

//! Una o dos líneas de firma, repartidas a lo ancho
const signatures = (doc, labels) => {
  //! Las firmas y el pie van juntos o no van
  ensureRoom(doc, 70);
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const y = doc.y;
  const slot = width / labels.length;

  labels.forEach((label, i) => {
    const from = left + slot * i + slot * 0.1;
    const to = left + slot * (i + 1) - slot * 0.1;
    doc.moveTo(from, y).lineTo(to, y).strokeColor(LINE).lineWidth(0.5).stroke();
    doc.font("Helvetica").fontSize(10).fillColor(INK)
      .text(label, from, y + 6, { width: to - from, align: "center" });
  });
  doc.y = y + 24;
};

//! Pie: cuándo se emitió y quién
const issuedLine = (doc, issuedBy) => {
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(
    `Emitido el ${longDate(new Date())}${issuedBy ? ` por ${issuedBy}` : ""}.`,
    doc.page.margins.left,
    doc.y,
    { width: contentWidth(doc), align: "center" }
  );
};

//! Nombre de archivo sin acentos ni espacios
const fileSlug = (text) =>
  String(text)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);

//! Manda el PDF ya armado con el nombre de archivo indicado
const sendPdf = (res, doc, filename) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  doc.pipe(res);
};

module.exports = {
  INK,
  MUTED,
  LINE,
  money,
  longDate,
  shortDate,
  capitalize,
  contentWidth,
  ensureRoom,
  rule,
  row,
  tableRow,
  header,
  section,
  note,
  signatures,
  issuedLine,
  fileSlug,
  sendPdf,
};
