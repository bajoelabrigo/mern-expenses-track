import { axiosInstance } from "../../lib/axios";

//! Listado de usuarios (solo admin)
export const getAllUsersAPI = async () => {
  const response = await axiosInstance.get("/admin/users");
  return response.data;
};

//! Dashboard de un usuario concreto (solo admin)
export const getUserDashboardAPI = async (userId, params = {}) => {
  const response = await axiosInstance.get(`/admin/dashboard/${userId}`, {
    params,
  });
  return response.data;
};
