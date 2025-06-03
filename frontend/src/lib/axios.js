import axios from "axios";
import { getUserFromStorage } from "../utils/getUserFromStorage";
import { BASE_URL } from "../utils/url";

// Creamos la instancia principal
export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Interceptor de request: agrega token si existe
axiosInstance.interceptors.request.use((config) => {
  const token = getUserFromStorage();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de respuesta: redirige si el token expiró o no es válido
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      error.response?.data?.message === "Token expired, login again"
    ) {
      localStorage.removeItem("userInfo"); // limpia sesión
      window.location.href = "/login"; // redirige al login
    }
    return Promise.reject(error);
  }
);
