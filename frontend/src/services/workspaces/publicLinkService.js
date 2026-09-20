import { axiosInstance } from "../../lib/axios";

//! Estado del enlace de solo lectura (nunca devuelve el token)
export const getPublicLinkAPI = async (id) => {
  const response = await axiosInstance.get(`/workspaces/${id}/enlace-publico`);
  return response.data;
};

//! Crea el enlace o lo rehace. La dirección completa viaja UNA sola vez:
//! después ya no se puede recuperar, solo rehacer.
export const createPublicLinkAPI = async ({ id, period, showFunds }) => {
  const response = await axiosInstance.post(`/workspaces/${id}/enlace-publico`, {
    period,
    showFunds,
  });
  return response.data;
};

export const updatePublicLinkAPI = async ({ id, ...changes }) => {
  const response = await axiosInstance.put(`/workspaces/${id}/enlace-publico`, changes);
  return response.data;
};

export const removePublicLinkAPI = async (id) => {
  const response = await axiosInstance.delete(`/workspaces/${id}/enlace-publico`);
  return response.data;
};

//! El resumen público. No lleva sesión: es lo que ve la congregación.
export const getPublicReportAPI = async (token) => {
  const response = await axiosInstance.get(`/publico/${token}`);
  return response.data;
};
