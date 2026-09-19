import { axiosInstance } from "../../lib/axios";

//! Fondos del espacio con su saldo; el primero siempre es "General" (_id null)
export const listFundsAPI = async () => {
  const response = await axiosInstance.get("/funds");
  return response.data;
};

export const createFundAPI = async ({ name, icon, description, goal }) => {
  const response = await axiosInstance.post("/funds", { name, icon, description, goal });
  return response.data;
};

//! También archiva / desarchiva (`archived`)
export const updateFundAPI = async ({ id, ...changes }) => {
  const response = await axiosInstance.put(`/funds/${id}`, changes);
  return response.data;
};

//! Solo si nunca se usó (si no, el servidor responde FUND_IN_USE)
export const deleteFundAPI = async (id) => {
  const response = await axiosInstance.delete(`/funds/${id}`);
  return response.data;
};

//! Pases entre fondos; `fund` = id o "general" para ver los de un fondo
export const listTransfersAPI = async ({ fund, limit } = {}) => {
  const response = await axiosInstance.get("/funds/transfers", { params: { fund, limit } });
  return response.data;
};

//! `from`/`to`: id del fondo o null para el General
export const createTransferAPI = async ({ from, to, amount, date, note }) => {
  const response = await axiosInstance.post("/funds/transfers", { from, to, amount, date, note });
  return response.data;
};

export const voidTransferAPI = async ({ id, reason }) => {
  const response = await axiosInstance.post(`/funds/transfers/${id}/void`, { reason });
  return response.data;
};
