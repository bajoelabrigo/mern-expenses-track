import axios from "axios";
import { BASE_URL } from "../utils/url";
import {
  clearStoredAuth,
  clearStoredWorkspaceId,
  getStoredToken,
  getStoredWorkspaceId,
} from "../utils/storage";

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
  //! Espacio en el que se trabaja; sin él la API usa el predeterminado
  const workspaceId = getStoredWorkspaceId();
  if (workspaceId && !config.headers["X-Workspace-Id"]) {
    config.headers["X-Workspace-Id"] = workspaceId;
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
      clearStoredWorkspaceId();
      window.location.assign("/login");
    }

    //! El espacio recordado ya no existe o ya no se pertenece a él (lo sacaron,
    //! se borró): se olvida y se recarga con el predeterminado.
    const code = error.response?.data?.code;
    if (
      (code === "NOT_A_MEMBER" || code === "WORKSPACE_NOT_FOUND") &&
      getStoredWorkspaceId() &&
      !redirigiendo
    ) {
      redirigiendo = true;
      clearStoredWorkspaceId();
      window.location.assign("/dashboard");
    }

    return Promise.reject(error);
  }
);

//! Mensaje de error legible para la UI (evita "Cannot read properties of undefined")
export const getErrorMessage = (error, fallback = "Algo salió mal. Inténtalo de nuevo.") =>
  error?.response?.data?.message || error?.message || fallback;
