const PDFDocument = require("pdfkit");
const { fromCents } = require("../utils/money");
const { amountInWords } = require("../utils/amountInWords");
const {
  MUTED,
  INK,
  money,
  contentWidth,
  row,
  header,
  section,
  note,
  signatures,
  issuedLine,
  fileSlug,
} = require("./pdfBits");

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

//! Una constancia (una página): quién aportó, cuánto y en qué se registró
const statementPage = (doc, { workspace, donor, summary, year, issuedBy, logo }) => {
  const { currency, name: churchName } = workspace;
  const left = doc.page.margins.left;
  const width = contentWidth(doc);

  header(doc, {
    churchName,
    kind: "Constancia de aportes",
    title: `CONSTANCIA DE APORTES ${year}`,
    logo,
  });

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
    section(doc, "Por tipo de aporte");
    summary.byKind.forEach((k) => row(doc, KIND_LABELS[k.kind] || KIND_LABELS.otro, money(k.amount, currency)));
    doc.moveDown(0.6);
  }

  if (summary.byMonth.length > 0) {
    section(doc, "Por mes");
    summary.byMonth.forEach((m) => row(doc, MONTHS[m.month - 1], money(m.amount, currency)));
    doc.moveDown(0.6);
  }

  row(doc, `Total ${year}`, money(summary.total, currency), { bold: true, top: true });
  doc.moveDown(2);

  note(
    doc,
    "Este documento resume los aportes registrados en la contabilidad de la iglesia y se entrega " +
      "a solicitud del aportante."
  );
  doc.moveDown(3);

  signatures(doc, ["Firma y sello de la tesorería"]);
  doc.moveDown(2);
  issuedLine(doc, issuedBy);
};

//! Documento con una constancia por aportante (una página cada una)
const buildStatements = ({ workspace, year, issuedBy, statements, logo }) => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 56,
    info: { Title: `Constancias ${year}` },
  });
  statements.forEach((statement, i) => {
    if (i > 0) doc.addPage();
    statementPage(doc, { workspace, year, issuedBy, logo, ...statement });
  });
  doc.end();
  return doc;
};

module.exports = { buildStatements, fileSlug, KIND_LABELS, fromCents };
