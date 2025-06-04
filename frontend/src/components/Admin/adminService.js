// services/admin/adminService.js
import { axiosInstance } from "../../lib/axios";

export const getAllUsersAPI = async () => {
  const res = await axiosInstance.get("/admin/users");
  return res.data;
};

export const getUserDashboardAPI = async (userId) => {
  const res = await axiosInstance.get(`/admin/user-dashboard/${userId}`);
  return res.data;
};
