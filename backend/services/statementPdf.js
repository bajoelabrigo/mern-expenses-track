const PDFDocument = require("pdfkit");
const { fromCents, formatMoney } = require("../utils/money");
const { amountInWords } = require("../utils/amountInWords");

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const KIND_LABELS = {
  diezmo: "Diezmos",
  ofrenda: "Ofrendas",
  primicia: "Primicias",
  especial: "Ofrendas especiales",
  otro: "Otros aportes",
};

//! Los montos se escriben como en la app (S/ 1,234.50)
const money = (amount, currency) => formatMoney(amount, currency);

const longDate = (date) =>
  date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

const INK = "#1f1405";
const MUTED = "#6b6862";
const LINE = "#d9d6cf";

//! Una fila de dos columnas (concepto / monto)
const row = (doc, label, value, { bold = false, top = false } = {}) => {
  const y = doc.y;
  if (top) {
    doc.moveTo(doc.page.margins.left, y - 4).lineTo(doc.page.width - doc.page.margins.right, y - 4)
      .strokeColor(LINE).lineWidth(0.5).stroke();
  }
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(11).fillColor(INK);
  doc.text(label, doc.page.margins.left, y, { continued: false });
  doc.text(value, doc.page.margins.left, y, {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    align: "right",
  });
  doc.moveDown(0.6);
};

//! Una constancia (una página): quién aportó, cuánto y en qué se registró
const statementPage = (doc, { workspace, donor, summary, year, issuedBy }) => {
  const { currency, name: churchName } = workspace;
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text(churchName, { align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor(MUTED)
    .text("Constancia de aportes", { align: "center" });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold").fontSize(14).fillColor(INK)
    .text(`CONSTANCIA DE APORTES ${year}`, { align: "center" });
  doc.moveDown(1.5);

  doc.font("Helvetica").fontSize(11).fillColor(INK).text(
    `${churchName} deja constancia de que ${donor.name}${donor.document ? `, con documento ${donor.document},` : ""} ` +
      `entregó los siguientes aportes durante el año ${year}:`,
    { width, align: "justify" }
  );
  doc.moveDown(1.2);

  row(doc, "Total aportado en el año", money(summary.total, currency), { bold: true, top: true });
  doc.font("Helvetica-Oblique").fontSize(10).fillColor(MUTED)
    .text(`Son: ${amountInWords(summary.total, currency)}.`, left, doc.y, { width });
  doc.moveDown(1.2);

  if (summary.byKind.length > 0) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Por tipo de aporte", left, doc.y);
    doc.moveDown(0.5);
    summary.byKind.forEach((k) => row(doc, KIND_LABELS[k.kind] || KIND_LABELS.otro, money(k.amount, currency)));
    doc.moveDown(0.6);
  }

  if (summary.byMonth.length > 0) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Por mes", left, doc.y);
    doc.moveDown(0.5);
    summary.byMonth.forEach((m) => row(doc, MONTHS[m.month - 1], money(m.amount, currency)));
    doc.moveDown(0.6);
  }

  row(doc, `Total ${year}`, money(summary.total, currency), { bold: true, top: true });
  doc.moveDown(2);

  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(
    "Este documento resume los aportes registrados en la contabilidad de la iglesia y se entrega " +
      "a solicitud del aportante.",
    left,
    doc.y,
    { width, align: "justify" }
  );
  doc.moveDown(3);

  //! Línea de firma
  const signY = doc.y;
  doc.moveTo(left + width / 4, signY).lineTo(left + (width * 3) / 4, signY)
    .strokeColor(LINE).lineWidth(0.5).stroke();
  doc.font("Helvetica").fontSize(10).fillColor(INK)
    .text("Firma y sello de la tesorería", left, signY + 6, { width, align: "center" });
  doc.moveDown(2);

  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(
    `Emitido el ${longDate(new Date())}${issuedBy ? ` por ${issuedBy}` : ""}.`,
    left,
    doc.y,
    { width, align: "center" }
  );
};

//! Documento con una constancia por aportante (una página cada una)
const buildStatements = ({ workspace, year, issuedBy, statements }) => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 56,
    info: { Title: `Constancias ${year}` },
  });
  statements.forEach((statement, i) => {
    if (i > 0) doc.addPage();
    statementPage(doc, { workspace, year, issuedBy, ...statement });
  });
  doc.end();
  return doc;
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

module.exports = { buildStatements, fileSlug, KIND_LABELS, fromCents };
