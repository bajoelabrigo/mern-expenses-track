//! Única fuente de verdad para la sesión guardada en el navegador.
//! Estructura almacenada: { token, user: { id, username, email, role, iglesia } }

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

export const clearStoredAuth = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    //! Modo privado o almacenamiento bloqueado: no hay nada que limpiar
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
