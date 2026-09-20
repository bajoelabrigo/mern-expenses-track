//! Informe de una actividad o fondo: lo que se recaudó, en qué se gastó y
//! cuánto sobró. Es el papel que la tesorería lee en la iglesia o pega en el
//! mural, así que se puede emitir sin los nombres de quienes dieron.

const PDFDocument = require("pdfkit");
const {
  INK,
  money,
  shortDate,
  longDate,
  capitalize,
  contentWidth,
  row,
  header,
  section,
  note,
  signatures,
  issuedLine,
} = require("./pdfBits");

//! Con qué nombre aparece el dinero que llegó desde otro fondo
const TRANSFER_LABEL = "Pase recibido";

//! El periodo que cubre el informe, a partir de las fechas que hay. Si empieza
//! y termina el mismo mes no se repite: "Del 5 al 16 de septiembre de 2026".
const periodLine = (movements) => {
  if (movements.length === 0) return "Sin movimientos registrados";
  const dates = movements.map((m) => m.date).sort((a, b) => a - b);
  const from = dates[0];
  const to = dates[dates.length - 1];

  if (from.toDateString() === to.toDateString()) return longDate(from);
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `Del ${from.getDate()} al ${longDate(to)}`;
  }
  return `Del ${longDate(from)} al ${longDate(to)}`;
};

//! Una lista de movimientos con su fecha, concepto y monto. `noteOf` arma la
//! línea gris de debajo (la categoría, quién dio) según lo que se quiera mostrar.
const movementList = (doc, items, currency, noteOf) => {
  items.forEach((item) => {
    //! Si la lista no cabe en lo que queda de hoja, pdfkit pasa de página solo
    row(doc, `${shortDate(item.date)}  ${item.concept}`, money(item.amount, currency), {
      note: noteOf(item),
    });
  });
};

//! El informe completo (una sola hoja si cabe; si no, sigue en la siguiente)
const buildFundReport = ({ workspace, fund, report, issuedBy, withNames }) => {
  const { currency, name: churchName } = workspace;
  const doc = new PDFDocument({
    size: "A4",
    margin: 56,
    info: { Title: `Informe ${fund.name}` },
  });

  header(doc, {
    churchName,
    kind: "Informe de actividad",
    title: fund.name.toUpperCase(),
  });

  if (fund.description) {
    doc.font("Helvetica").fontSize(11).fillColor(INK)
      .text(fund.description, { width: contentWidth(doc), align: "center" });
    doc.moveDown(0.4);
  }
  note(doc, periodLine([...report.income, ...report.expenses]), { align: "center" });
  doc.moveDown(1.2);

  //! El resumen primero: es lo que la gente quiere saber
  row(doc, "Se recaudó", money(report.raised, currency), { bold: true, top: true });
  row(doc, "Se gastó", money(report.spent, currency), { bold: true });
  //! Lo que se pasó a otro fondo no es un gasto, pero sí sale de la actividad
  if (report.movedOut > 0) {
    row(doc, "Se pasó a otros fondos", money(report.movedOut, currency), { bold: true });
  }
  row(doc, "Quedó", money(report.balance, currency), { bold: true, top: true });
  if (fund.goal) {
    doc.moveDown(0.2);
    note(doc, `Meta de la campaña: ${money(fund.goal, currency)}.`, { align: "left" });
  }
  doc.moveDown(1.2);

  if (report.income.length > 0) {
    section(doc, withNames ? "Lo que entró" : "Lo que entró (sin nombres)");
    movementList(doc, report.income, currency, (item) => {
      const parts = [capitalize(item.category)];
      if (withNames && item.donor) parts.push(item.donor);
      return parts.filter(Boolean).join(" · ");
    });
    row(doc, "Total de lo que entró", money(report.raised, currency), { bold: true, top: true });
    doc.moveDown(1);
  }

  if (report.expenses.length > 0) {
    section(doc, "Lo que salió");
    movementList(doc, report.expenses, currency, (item) =>
      [capitalize(item.category), item.receipt ? "con recibo" : "sin recibo"].filter(Boolean).join(" · ")
    );
    row(doc, "Total de lo que salió", money(report.spent, currency), { bold: true, top: true });
    doc.moveDown(0.6);
    note(
      doc,
      `${report.withReceipt} de ${report.expenses.length} ` +
        `${report.expenses.length === 1 ? "gasto tiene" : "gastos tienen"} comprobante guardado en la app.`,
      { align: "left" }
    );
    doc.moveDown(1);
  }

  if (report.income.length === 0 && report.expenses.length === 0) {
    note(doc, "Todavía no hay movimientos registrados en esta actividad.", { align: "left" });
    doc.moveDown(1);
  }

  doc.moveDown(1.5);
  signatures(doc, ["Tesorería", "Revisado por"]);
  doc.moveDown(2);
  issuedLine(doc, issuedBy);

  doc.end();
  return doc;
};

module.exports = { buildFundReport, TRANSFER_LABEL, periodLine };
