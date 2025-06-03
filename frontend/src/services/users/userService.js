import { axiosInstance } from "../../lib/axios";

//! Login
export const loginAPI = async ({ email, password }) => {
  const response = await axiosInstance.post("/users/login", {
    email,
    password,
  });
  return response.data;
};

//! Register
export const registerAPI = async ({ email, password, username }) => {
  const response = await axiosInstance.post("/users/register", {
    email,
    password,
    username,
  });
  return response.data;
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
