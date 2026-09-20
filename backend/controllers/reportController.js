const asyncHandler = require("express-async-handler");
const { monthlyReport, annualReport } = require("../services/reportService");
const { buildMonthlyReport, buildAnnualReport, MONTHS } = require("../services/reportPdf");
const { fileSlug, sendPdf } = require("../services/pdfBits");
const { logoBytesFor } = require("../services/logoStorage");

//! Año válido para un informe. Fuera de rango no tiene sentido pedirlo.
const parseYear = (value) => {
  const year = value === undefined ? new Date().getFullYear() : Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
};

const parseMonth = (value) => {
  const month = value === undefined ? new Date().getMonth() + 1 : Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
};

const isChurch = (req) => req.workspace.kind === "iglesia";

const reportController = {
  //! Informe mensual en PDF
  monthly: asyncHandler(async (req, res) => {
    const year = parseYear(req.query.year);
    const month = parseMonth(req.query.month);
    if (year === null || month === null) {
      return res.status(400).json({ message: "Mes o año inválido" });
    }

    const [report, logo] = await Promise.all([
      monthlyReport(req.workspace._id, year, month, isChurch(req)),
      logoBytesFor(req.workspace),
    ]);
    const doc = buildMonthlyReport({
      workspace: req.workspace,
      report,
      issuedBy: req.user.username,
      logo,
    });
    const nombre = MONTHS[month - 1].toLowerCase();
    sendPdf(res, doc, `informe-${fileSlug(req.workspace.name)}-${nombre}-${year}.pdf`);
  }),

  //! Informe anual en PDF
  annual: asyncHandler(async (req, res) => {
    const year = parseYear(req.query.year);
    if (year === null) return res.status(400).json({ message: "Año inválido" });

    const [report, logo] = await Promise.all([
      annualReport(req.workspace._id, year, isChurch(req)),
      logoBytesFor(req.workspace),
    ]);
    const doc = buildAnnualReport({
      workspace: req.workspace,
      report,
      issuedBy: req.user.username,
      logo,
    });
    sendPdf(res, doc, `informe-${fileSlug(req.workspace.name)}-${year}.pdf`);
  }),
};

module.exports = reportController;
