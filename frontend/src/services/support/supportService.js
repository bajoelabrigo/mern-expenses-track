import { axiosInstance } from "../../lib/axios";

//! Si se puede aportar ahora mismo y cuánto lleva aportado esta persona
export const getSupportStatusAPI = async () => {
  const response = await axiosInstance.get("/socio/estado");
  return response.data;
};

//! Abre la orden en PayPal y devuelve su id, que necesita el botón
export const createSupportOrderAPI = async (amount) => {
  const response = await axiosInstance.post("/socio/orden", { amount });
  return response.data;
};

//! Confirma el cobro en cuanto la persona aprueba el pago
export const captureSupportAPI = async (orderId) => {
  const response = await axiosInstance.post("/socio/capturar", { orderId });
  return response.data;
};
