import { axiosInstance } from "./axios";

//! Pide un PDF al servidor y lo baja al dispositivo. Devuelve el nombre del
//! archivo para poder avisar "Se descargó …". Lo usan las constancias de
//! aportes y los informes de actividad.
export const downloadPdf = async (url, { params = {}, fallbackName } = {}) => {
  const response = await axiosInstance.get(url, { params, responseType: "blob" });

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
