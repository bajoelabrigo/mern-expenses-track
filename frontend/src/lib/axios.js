import axios from "axios";
import { BASE_URL } from "../utils/url";
import { clearStoredAuth, getStoredToken } from "../utils/storage";

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // envía la cookie httpOnly cuando el dominio coincide
});

//! Request: adjunta el token (necesario cuando el frontend vive en otro dominio
//! y la cookie SameSite no viaja).
axiosInstance.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

//! Evita disparar varias redirecciones si fallan varias peticiones a la vez
let redirigiendo = false;

//! Response: cualquier 401 cierra la sesión local y manda al login.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const enLogin = window.location.pathname === "/login";

    if (status === 401 && !enLogin && !redirigiendo) {
      redirigiendo = true;
      clearStoredAuth();
      window.location.assign("/login");
    }

    return Promise.reject(error);
  }
);

//! Mensaje de error legible para la UI (evita "Cannot read properties of undefined")
export const getErrorMessage = (error, fallback = "Algo salió mal. Inténtalo de nuevo.") =>
  error?.response?.data?.message || error?.message || fallback;
