import { axiosInstance } from "../../lib/axios";

//! Login: devuelve { token, user } para guardarlos juntos en la sesión
export const loginAPI = async ({ email, password }) => {
  const response = await axiosInstance.post("/users/login", {
    email,
    password,
  });
  return { token: response.data.token, user: response.data.user };
};

//! Registro. `iglesia` es opcional: si llega, se crea también su espacio.
export const registerAPI = async ({ email, password, username, iglesia, currency }) => {
  const response = await axiosInstance.post("/users/register", {
    email,
    password,
    username,
    iglesia: iglesia || undefined,
    currency: currency || undefined,
  });
  return response.data.user;
};

//! Pedir el enlace para restablecer la contraseña
export const forgotPasswordAPI = async ({ email }) => {
  const response = await axiosInstance.post("/users/forgot-password", { email });
  return response.data;
};

//! Fijar la contraseña nueva con el token del enlace
export const resetPasswordAPI = async ({ token, password }) => {
  const response = await axiosInstance.post(`/users/reset-password/${token}`, {
    password,
  });
  return response.data;
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
