import { axiosInstance } from "../../lib/axios";

//! Aportantes con lo que dio cada uno en el año. Solo responde a quien puede
//! verlos (propietario, tesorero y contador); a los demás el servidor
//! responde 403.
export const listDonorsAPI = async ({ year } = {}) => {
  const response = await axiosInstance.get("/donors", { params: { year } });
  return response.data;
};

export const getDonorAPI = async ({ id, year }) => {
  const response = await axiosInstance.get(`/donors/${id}`, { params: { year } });
  return response.data;
};

export const createDonorAPI = async (donor) => {
  const response = await axiosInstance.post("/donors", donor);
  return response.data;
};

//! También archiva / desarchiva (`archived`)
export const updateDonorAPI = async ({ id, ...changes }) => {
  const response = await axiosInstance.put(`/donors/${id}`, changes);
  return response.data;
};

//! Solo si nunca recibió un aporte (si no, el servidor responde DONOR_IN_USE)
export const deleteDonorAPI = async (id) => {
  const response = await axiosInstance.delete(`/donors/${id}`);
  return response.data;
};
