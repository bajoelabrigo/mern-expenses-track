import { axiosInstance } from "../../lib/axios";
import { downloadPdf } from "../../lib/downloadPdf";

//! Personas del espacio: lo que dieron y lo que se les pagó en el año. Solo
//! responde a quien puede verlas (propietario, tesorero y contador); a los
//! demás el servidor responde 403.
export const listDonorsAPI = async ({ year } = {}) => {
  const response = await axiosInstance.get("/donors", { params: { year } });
  return response.data;
};

export const getDonorAPI = async ({ id, year }) => {
  const response = await axiosInstance.get(`/donors/${id}`, { params: { year } });
  return response.data;
};

export const createDonorAPI = async (donor) => {
  const response = await axiosInstance.post("/donors", donor);
  return response.data;
};

//! También archiva / desarchiva (`archived`)
export const updateDonorAPI = async ({ id, ...changes }) => {
  const response = await axiosInstance.put(`/donors/${id}`, changes);
  return response.data;
};

//! Solo si nunca recibió un aporte (si no, el servidor responde DONOR_IN_USE)
export const deleteDonorAPI = async (id) => {
  const response = await axiosInstance.delete(`/donors/${id}`);
  return response.data;
};

export const downloadStatementAPI = ({ id, year }) =>
  downloadPdf(`/donors/${id}/constancia`, { params: { year }, fallbackName: `constancia-${year}.pdf` });

export const downloadStatementsAPI = ({ year }) =>
  downloadPdf("/donors/constancias", { params: { year }, fallbackName: `constancias-${year}.pdf` });

//! Lo que la iglesia le pagó a la persona en el año (con "Recibí conforme")
export const downloadPaymentStatementAPI = ({ id, year }) =>
  downloadPdf(`/donors/${id}/constancia-pagos`, {
    params: { year },
    fallbackName: `constancia-pagos-${year}.pdf`,
  });

export const downloadPaymentStatementsAPI = ({ year }) =>
  downloadPdf("/donors/constancias-pagos", {
    params: { year },
    fallbackName: `constancias-pagos-${year}.pdf`,
  });

//! Informe de pagos a personas del año (para la pantalla de Informes)
export const getPaymentsReportAPI = async ({ year } = {}) => {
  const response = await axiosInstance.get("/donors/pagos", { params: { year } });
  return response.data;
};
