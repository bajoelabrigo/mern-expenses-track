import { axiosInstance } from "../../lib/axios";

//! Usuarios con sus espacios (solo admin de la plataforma)
export const getAllUsersAPI = async () => {
  const response = await axiosInstance.get("/admin/users");
  return response.data;
};

//! Espacios con miembros y movimientos (solo admin de la plataforma)
export const getAllWorkspacesAPI = async () => {
  const response = await axiosInstance.get("/admin/workspaces");
  return response.data;
};
