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

//! Abre el aporte mensual y devuelve a dónde mandar a la persona para
//! aprobarlo. Aquí todavía no se ha cobrado nada.
export const createSubscriptionAPI = async (amount) => {
  const response = await axiosInstance.post("/socio/suscripcion", { amount });
  return response.data;
};

//! Deja de cobrar en adelante; lo ya aportado no se toca
export const cancelSubscriptionAPI = async () => {
  const response = await axiosInstance.delete("/socio/suscripcion");
  return response.data;
};
