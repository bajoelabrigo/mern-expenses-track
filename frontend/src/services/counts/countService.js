import { axiosInstance } from "../../lib/axios";

//! Conteos del espacio; los que esperan segunda firma van primero
export const listCountsAPI = async () => {
  const response = await axiosInstance.get("/conteos");
  return response.data;
};

//! Primera firma. `breakdown`: [{ value, count }] o nada y solo `amount`.
export const createCountAPI = async ({ date, service, amount, breakdown, category, fund, note }) => {
  const response = await axiosInstance.post("/conteos", {
    date,
    service,
    amount,
    breakdown,
    category,
    fund,
    note,
  });
  return response.data;
};

//! Segunda firma: tiene que ser otra persona, y recién ahí entra al libro
export const confirmCountAPI = async (id) => {
  const response = await axiosInstance.post(`/conteos/${id}/confirmar`);
  return response.data;
};

export const voidCountAPI = async ({ id, reason }) => {
  const response = await axiosInstance.post(`/conteos/${id}/anular`, { reason });
  return response.data;
};
