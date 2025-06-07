import { axiosInstance } from "../../lib/axios";

//! Add Transaction
export const addTransactionAPI = async ({
  type,
  category,
  date,
  description,
  amount,
}) => {
  const response = await axiosInstance.post("/transactions/create", {
    type,
    category,
    date,
    amount,
    description,
  });
  return response.data;
};

//! Update Transaction
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

//! Delete Transaction
export const deleteTransactionAPI = async (id) => {
  const response = await axiosInstance.delete(`/transactions/delete/${id}`);
  return response.data;
};

//! List Transactions with Filters
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

//! Get Single Transaction by ID
export const fetchTransactionByIdAPI = async (id) => {
  if (!id) throw new Error("Transaction ID is required");
  const response = await axiosInstance.get(`/transactions/${id}`);
  return response.data;
};

//! 🔁 Obtener transacciones por periodo o rango personalizado
export const getTransactionByPeriodAPI = async ({
  period,
  type,
  startDate,
  endDate,
}) => {
  const response = await axiosInstance.get("/transactions/period", {
    params: {
      period,
      type,
      startDate,
      endDate,
    },
  });

  return response.data;
};

//! Export Transactions to Excel
export const exportTransactionExcelAPI = async () => {
  const response = await axiosInstance.get("/transactions/export/excel", {
    responseType: "blob",
  });

  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "transactions_report.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
};
