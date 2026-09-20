import { downloadPdf } from "../../lib/downloadPdf";

//! Informe de un mes en PDF
export const downloadMonthlyReportAPI = ({ year, month }) =>
  downloadPdf("/reports/mensual", {
    params: { year, month },
    fallbackName: `informe-${year}-${month}.pdf`,
  });

//! Informe de un año en PDF
export const downloadAnnualReportAPI = ({ year }) =>
  downloadPdf("/reports/anual", { params: { year }, fallbackName: `informe-${year}.pdf` });
