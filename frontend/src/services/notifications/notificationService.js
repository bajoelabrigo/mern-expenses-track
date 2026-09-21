import { axiosInstance } from "../../lib/axios";

//! Avisos del espacio (la campana). El backend los saca del historial de
//! auditoría y decide qué ve cada rol, así que aquí no se filtra nada.

export const listNotificationsAPI = async ({ limit } = {}) => {
  const response = await axiosInstance.get("/avisos", { params: { limit } });
  return response.data;
};

export const markNotificationsReadAPI = async () => {
  const response = await axiosInstance.post("/avisos/leidas");
  return response.data;
};

//! ── Avisos al teléfono (Web Push) ──
export const pushStatusAPI = async () => {
  const response = await axiosInstance.get("/avisos/push");
  return response.data;
};

export const subscribePushAPI = async (subscription) => {
  const response = await axiosInstance.post("/avisos/push", { subscription });
  return response.data;
};

export const unsubscribePushAPI = async (endpoint) => {
  const response = await axiosInstance.delete("/avisos/push", { data: { endpoint } });
  return response.data;
};

export const testPushAPI = async () => {
  const response = await axiosInstance.post("/avisos/prueba");
  return response.data;
};
