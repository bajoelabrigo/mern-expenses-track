import { axiosInstance } from "../../lib/axios";

//! Crear transacción (soporta recurrencia)
export const addTransactionAPI = async ({
  type,
  category,
  date,
  description,
  amount,
  recurrent,
  recurrenceType,
  recurrenceCount,
}) => {
  const response = await axiosInstance.post("/transactions/create", {
    type,
    category,
    date,
    amount,
    description,
    recurrent,
    recurrenceType,
    recurrenceCount,
  });
  return response.data;
};

//! Actualizar transacción
export const updateTransactionAPI = async ({
  type,
  category,
  amount,
  date,
  description,
  id,
}) => {
  const response = await axiosInstance.put(`/transactions/update/${id}`, {
    type,
    category,
    amount,
    date,
    description,
  });
  return response.data;
};

//! Eliminar transacción
export const deleteTransactionAPI = async (id) => {
  const response = await axiosInstance.delete(`/transactions/delete/${id}`);
  return response.data;
};

//! Listado paginado con filtros
export const listTransationsAPI = async ({
  category,
  type,
  startDate,
  endDate,
  page,
  limit,
}) => {
  const response = await axiosInstance.get("/transactions/lists", {
    params: { category, type, startDate, endDate, page, limit },
  });
  return response.data;
};

//! Una transacción por id
export const fetchTransactionByIdAPI = async (id) => {
  if (!id) throw new Error("El id de la transacción es obligatorio");
  const response = await axiosInstance.get(`/transactions/${id}`);
  return response.data;
};

//! Transacciones por período o rango personalizado
export const getTransactionByPeriodAPI = async ({
  period,
  type,
  category,
  startDate,
  endDate,
}) => {
  const response = await axiosInstance.get("/transactions/period", {
    params: { period, type, category, startDate, endDate },
  });
  return response.data;
};

//! Balance (ingresos, gastos y saldo) con los mismos filtros del listado
export const getBalanceAPI = async ({ startDate, endDate, type, category } = {}) => {
  const response = await axiosInstance.get("/transactions/balance", {
    params: { startDate, endDate, type, category },
  });
  return response.data;
};

//! Resumen del mes en curso
export const getMonthlySummaryAPI = async () => {
  const response = await axiosInstance.get("/transactions/summary/monthly");
  return response.data;
};

//! Exporta a Excel respetando los filtros y dispara la descarga en el navegador.
//! Devuelve el nombre del archivo generado.
export const exportTransactionExcelAPI = async ({
  startDate,
  endDate,
  type,
  category,
} = {}) => {
  const response = await axiosInstance.get("/transactions/export/excel", {
    params: { startDate, endDate, type, category },
    responseType: "blob",
  });

  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const fileName = `transacciones_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url); // libera memoria

  return fileName;
};
