//! Bandeja de salida: movimientos registrados sin conexión que esperan a
//! enviarse. Vive en localStorage para sobrevivir a cerrar la app.
//!
//! Cada elemento: { id, userId, workspaceId, workspaceName, payload, createdAt,
//!                  status: "pending" | "failed", error }
//! El `id` viaja como `clientId`: si un envío llegó pero se perdió la
//! respuesta, el reintento no duplica el movimiento (lo reconoce el servidor).

import { getErrorMessage, isNetworkError } from "./axios";

const KEY = "cg-outbox";
const listeners = new Set();

//! Cache de la lectura: useSyncExternalStore exige devolver el MISMO objeto
//! mientras no cambie, o entra en un bucle de renders.
let cachedRaw = null;
let cachedItems = [];

export const readOutbox = () => {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cachedItems;
  }
  if (raw === cachedRaw) return cachedItems;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw || "[]");
    cachedItems = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedItems = [];
  }
  return cachedItems;
};

const writeOutbox = (items) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    //! Sin almacenamiento: lo pendiente vive solo mientras la app esté abierta
    cachedRaw = null;
    cachedItems = items;
  }
  listeners.forEach((listener) => listener());
};

export const subscribeOutbox = (listener) => {
  listeners.add(listener);
  //! Otra pestaña de la app modificó la bandeja
  const onStorage = (event) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

//! Identificador único para el movimiento (8–64 caracteres [A-Za-z0-9_-])
export const newClientId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

export const addToOutbox = (item) =>
  writeOutbox([
    ...readOutbox(),
    { status: "pending", error: "", createdAt: new Date().toISOString(), ...item },
  ]);

export const removeFromOutbox = (id) =>
  writeOutbox(readOutbox().filter((item) => item.id !== id));

export const updateOutboxItem = (id, patch) =>
  writeOutbox(readOutbox().map((item) => (item.id === id ? { ...item, ...patch } : item)));

let syncing = false;

//! Envía lo pendiente del usuario, uno a uno y en orden. Se detiene al primer
//! error de red (sigue sin conexión) o de sesión (hay que volver a entrar); un
//! rechazo del servidor (p. ej. ya no tiene permiso en ese espacio) marca el
//! elemento como fallido para que la persona decida. Devuelve cuántos envió.
export const syncOutbox = async ({ userId, send }) => {
  if (syncing || !userId) return 0;
  syncing = true;
  let sent = 0;
  try {
    const pending = readOutbox().filter(
      (item) => item.userId === userId && item.status === "pending"
    );
    for (const item of pending) {
      try {
        await send(item);
        removeFromOutbox(item.id);
        sent += 1;
      } catch (error) {
        if (isNetworkError(error) || error?.response?.status === 401) break;
        updateOutboxItem(item.id, { status: "failed", error: getErrorMessage(error) });
      }
    }
  } finally {
    syncing = false;
  }
  return sent;
};
