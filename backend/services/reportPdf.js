//! Los informes mensual y anual de la tesorería. Se leen en la iglesia y se
//! archivan firmados, así que abren con el saldo con el que empezó el periodo
//! y cierran con el que queda: quien los lea puede seguir el dinero de un
//! informe al siguiente sin rehacer las cuentas.

const PDFDocument = require("pdfkit");
const {
  money,
  capitalize,
  contentWidth,
  row,
  tableRow,
  header,
  section,
  note,
  signatures,
  issuedLine,
} = require("./pdfBits");
const { KIND_LABELS } = require("./statementPdf");

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

//! Los meses cortos de la tabla anual, que va más apretada
const MONTHS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

//! Con qué nombre se muestra cada línea del desglose de ingresos: por tipo de
//! aporte en una iglesia, por categoría en un espacio personal
const incomeLabel = (item) =>
  item.kind ? KIND_LABELS[item.kind] || KIND_LABELS.otro : capitalize(item.category);

//! El bloque que abre los dos informes: de cuánto se partía, qué se movió y
//! con cuánto se cierra
const summaryBlock = (doc, report, currency) => {
  row(doc, "Saldo al comenzar", money(report.opening, currency), { top: true });
  row(doc, "Entró", money(report.income, currency));
  row(doc, "Salió", money(report.expense, currency));
  row(doc, "Resultado del periodo", money(report.result, currency), { bold: true });
  row(doc, "Saldo al cerrar", money(report.closing, currency), { bold: true, top: true });
  doc.moveDown(1);
};

//! Los desgloses de ingresos y gastos, iguales en los dos informes
const breakdowns = (doc, report, currency) => {
  if (report.incomeBreakdown.length > 0) {
    section(doc, "De dónde entró");
    report.incomeBreakdown.forEach((item) =>
      row(doc, incomeLabel(item), money(item.amount, currency))
    );
    row(doc, "Total de lo que entró", money(report.income, currency), { bold: true, top: true });
    doc.moveDown(1);
  }

  if (report.expenseBreakdown.length > 0) {
    section(doc, "En qué se fue");
    report.expenseBreakdown.forEach((item) =>
      row(doc, capitalize(item.category), money(item.amount, currency))
    );
    row(doc, "Total de lo que salió", money(report.expense, currency), { bold: true, top: true });
    doc.moveDown(0.6);
    if (report.receipts.total > 0) {
      note(
        doc,
        `${report.receipts.withReceipt} de ${report.receipts.total} ` +
          `${report.receipts.total === 1 ? "gasto tiene" : "gastos tienen"} comprobante guardado en la app.`,
        { align: "left" }
      );
    }
    doc.moveDown(1);
  }
};

//! Cómo está repartido el dinero al cerrar
const fundsBlock = (doc, funds, currency) => {
  //! Con un solo fondo (el General) no hay nada que repartir
  if (funds.length <= 1) return;
  section(doc, "Cómo está repartido");
  funds.forEach((f) => row(doc, f.name, money(f.amount, currency)));
  doc.moveDown(1);
};

//! Pie común: firmas y quién lo emitió
const footer = (doc, issuedBy) => {
  doc.moveDown(1.5);
  signatures(doc, ["Tesorería", "Revisado por"]);
  doc.moveDown(2);
  issuedLine(doc, issuedBy);
};

const newDoc = (title) =>
  new PDFDocument({ size: "A4", margin: 56, info: { Title: title } });

//! Informe de un mes
const buildMonthlyReport = ({ workspace, report, issuedBy }) => {
  const { currency, name: churchName } = workspace;
  const title = `${MONTHS[report.month - 1].toUpperCase()} ${report.year}`;
  const doc = newDoc(`Informe ${title}`);

  header(doc, { churchName, kind: "Informe mensual de tesorería", title });
  summaryBlock(doc, report, currency);
  breakdowns(doc, report, currency);
  fundsBlock(doc, report.funds, currency);

  if (report.income === 0 && report.expense === 0) {
    note(doc, "No se registraron movimientos en este mes.", { align: "left" });
    doc.moveDown(1);
  }

  footer(doc, issuedBy);
  doc.end();
  return doc;
};

//! Informe de un año, con la tabla mes a mes
const buildAnnualReport = ({ workspace, report, issuedBy }) => {
  const { currency, name: churchName } = workspace;
  const doc = newDoc(`Informe ${report.year}`);

  header(doc, {
    churchName,
    kind: "Informe anual de tesorería",
    title: `AÑO ${report.year}`,
  });
  summaryBlock(doc, report, currency);

  section(doc, "Mes a mes");
  tableRow(doc, "", ["Entró", "Salió", "Resultado"], { bold: true, muted: true });
  report.months.forEach((m) =>
    tableRow(doc, MONTHS_SHORT[m.month - 1], [
      money(m.income, currency),
      money(m.expense, currency),
      money(m.result, currency),
    ])
  );
  tableRow(
    doc,
    "Año completo",
    [money(report.income, currency), money(report.expense, currency), money(report.result, currency)],
    { bold: true, top: true }
  );
  doc.moveDown(1.2);

  breakdowns(doc, report, currency);
  fundsBlock(doc, report.funds, currency);
  footer(doc, issuedBy);

  doc.end();
  return doc;
};

module.exports = { buildMonthlyReport, buildAnnualReport, MONTHS, incomeLabel, contentWidth };
