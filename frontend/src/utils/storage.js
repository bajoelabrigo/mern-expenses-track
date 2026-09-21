//! Única fuente de verdad para la sesión guardada en el navegador.
//! Estructura almacenada: { token, user: { id, username, email, role, defaultWorkspace } }

const STORAGE_KEY = "userInfo";

//! Lee la fecha de expiración del JWT sin librerías externas.
const getTokenExpiration = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

export const isTokenExpired = (token) => {
  if (!token) return true;
  const expiresAt = getTokenExpiration(token);
  if (!expiresAt) return false; // sin exp: lo decide el backend
  return Date.now() >= expiresAt;
};

//! Datos de la API guardados en el dispositivo (ver lib/queryClient.js)
const QUERY_CACHE_KEY = "cg-cache";

//! Al borrar la sesión se borran también los datos guardados: si caduca (401)
//! no se pasa por "Salir", y el siguiente usuario del dispositivo vería los
//! del anterior al abrir la app.
export const clearStoredAuth = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(QUERY_CACHE_KEY);
  } catch {
    //! Modo privado o almacenamiento bloqueado: no hay nada que limpiar
  }
};

//! Borra SOLO los datos guardados de la API, sin cerrar la sesión.
//!
//! Es lo que necesita el botón "Recargar" cuando la app se rompe: si lo que
//! falló fue una respuesta que quedó guardada y no era lo que se esperaba
//! (una página de error con 200, por ejemplo), recargar sin borrarla vuelve a
//! romperse igual, una y otra vez, sin manera de salir para quien no sabe
//! vaciar los datos del sitio.
export const clearStoredData = () => {
  try {
    localStorage.removeItem(QUERY_CACHE_KEY);
  } catch {
    //! Sin almacenamiento no hay nada guardado que borrar
  }
};

//! Devuelve { token, user } o null si no hay sesión válida.
export const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.token || !parsed.user) {
      clearStoredAuth();
      return null;
    }

    if (isTokenExpired(parsed.token)) {
      clearStoredAuth();
      return null;
    }

    return parsed;
  } catch {
    clearStoredAuth();
    return null;
  }
};

export const setStoredAuth = (auth) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } catch {
    //! Si el navegador no permite escribir, la sesión vive solo en memoria
  }
};

export const getStoredToken = () => getStoredAuth()?.token || null;

export const getStoredUser = () => getStoredAuth()?.user || null;

//! Espacio de trabajo elegido (se recuerda entre visitas en este dispositivo)
const WORKSPACE_KEY = "workspaceId";

export const getStoredWorkspaceId = () => {
  try {
    return localStorage.getItem(WORKSPACE_KEY) || null;
  } catch {
    return null;
  }
};

export const setStoredWorkspaceId = (id) => {
  try {
    localStorage.setItem(WORKSPACE_KEY, id);
  } catch {
    //! Sin almacenamiento el espacio se elige de nuevo en cada visita
  }
};

export const clearStoredWorkspaceId = () => {
  try {
    localStorage.removeItem(WORKSPACE_KEY);
  } catch {
    //! Nada que limpiar
  }
};
