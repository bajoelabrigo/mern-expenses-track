import { axiosInstance } from "../../lib/axios";

//! Login: devuelve { token, user } para guardarlos juntos en la sesión
export const loginAPI = async ({ email, password }) => {
  const response = await axiosInstance.post("/users/login", {
    email,
    password,
  });
  return { token: response.data.token, user: response.data.user };
};

//! Registro
export const registerAPI = async ({ email, password, username, iglesia }) => {
  const response = await axiosInstance.post("/users/register", {
    email,
    password,
    username,
    iglesia,
  });
  return response.data.user;
};

//! Logout: limpia la cookie httpOnly en el servidor
export const logoutAPI = async () => {
  const response = await axiosInstance.post("/users/logout");
  return response.data;
};

//! Perfil del usuario autenticado
export const getProfileAPI = async () => {
  const response = await axiosInstance.get("/users/profile");
  return response.data;
};

//! Cambio de contraseña (exige la contraseña actual)
export const changePasswordAPI = async ({ currentPassword, newPassword }) => {
  const response = await axiosInstance.put("/users/change-password", {
    currentPassword,
    newPassword,
  });
  return response.data;
};

//! Actualización de perfil
export const updateProfileAPI = async ({ email, username }) => {
  const response = await axiosInstance.put("/users/update-profile", {
    email,
    username,
  });
  return response.data;
};
