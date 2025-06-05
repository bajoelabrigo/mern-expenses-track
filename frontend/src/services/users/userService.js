import { axiosInstance } from "../../lib/axios";

//! Login
export const loginAPI = async ({ email, password }) => {
  const response = await axiosInstance.post("/users/login", {
    email,
    password,
  });
  return response.data.user;
};

//! Register
export const registerAPI = async ({ email, password, username, iglesia }) => {
  const response = await axiosInstance.post("/users/register", {
    email,
    password,
    username,
    iglesia,
  });
  return response.data.user;
};

//! Change Password
export const changePasswordAPI = async (newPassword) => {
  const response = await axiosInstance.put("/users/change-password", {
    newPassword,
  });
  return response.data;
};

//! Update Profile
export const updateProfileAPI = async ({ email, username }) => {
  const response = await axiosInstance.put("/users/update-profile", {
    email,
    username,
  });
  return response.data;
};
