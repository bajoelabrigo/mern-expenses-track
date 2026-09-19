import { axiosInstance } from "../../lib/axios";

//! Aportantes con lo que dio cada uno en el año. Solo responde a quien puede
//! verlos (propietario, tesorero y contador); a los demás el servidor
//! responde 403.
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

//! Descarga un PDF de constancias y devuelve el nombre del archivo. `id` para
//! una persona; sin `id`, todas las del año en un solo archivo.
const downloadPdf = async (url, { year, fallbackName }) => {
  const response = await axiosInstance.get(url, { params: { year }, responseType: "blob" });

  //! El servidor manda el nombre en la cabecera; si no llega, uno de reserva
  const header = response.headers["content-disposition"] || "";
  const fileName = header.match(/filename=([^;]+)/)?.[1]?.trim() || fallbackName;

  const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
  return fileName;
};

export const downloadStatementAPI = ({ id, year }) =>
  downloadPdf(`/donors/${id}/constancia`, { year, fallbackName: `constancia-${year}.pdf` });

export const downloadStatementsAPI = ({ year }) =>
  downloadPdf("/donors/constancias", { year, fallbackName: `constancias-${year}.pdf` });
