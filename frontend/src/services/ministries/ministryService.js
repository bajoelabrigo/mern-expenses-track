import { axiosInstance } from "../../lib/axios";

//! Los ministerios del año con su avance. Un líder recibe solo el suyo.
export const listMinistriesAPI = async (year) => {
  const response = await axiosInstance.get("/ministerios", { params: { year } });
  return response.data;
};

//! Los gastos cargados a un ministerio
export const listMinistryExpensesAPI = async (id) => {
  const response = await axiosInstance.get(`/ministerios/${id}/gastos`);
  return response.data;
};

export const createMinistryAPI = async ({ name, budget, year, icon, leader }) => {
  const response = await axiosInstance.post("/ministerios", { name, budget, year, icon, leader });
  return response.data;
};

//! También archiva / desarchiva (`archived`)
export const updateMinistryAPI = async ({ id, ...changes }) => {
  const response = await axiosInstance.put(`/ministerios/${id}`, changes);
  return response.data;
};

//! Solo si nunca se le cargó nada (si no, responde MINISTRY_IN_USE)
export const deleteMinistryAPI = async (id) => {
  const response = await axiosInstance.delete(`/ministerios/${id}`);
  return response.data;
};
