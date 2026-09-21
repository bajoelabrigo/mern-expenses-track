//! Avisos al teléfono desde el navegador (Web Push). El servidor los manda
//! firmados; aquí solo se pide permiso, se suscribe ESTE aparato y se avisa al
//! backend de la suscripción.

export const soportado = () =>
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  typeof Notification !== "undefined";

export const permiso = () =>
  typeof Notification === "undefined" ? "default" : Notification.permission;

//! En iPhone, los avisos solo funcionan con la app instalada en la pantalla de
//! inicio (iOS 16.4 o posterior). Sin instalar, Safari no ofrece el permiso.
export const esIOS = () =>
  typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);

export const instalada = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.navigator.standalone === true);

//! La clave pública viaja en base64url y el navegador la quiere en bytes
const aBytes = (base64) => {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(normal);
  return Uint8Array.from([...crudo].map((letra) => letra.charCodeAt(0)));
};

//! El service worker tiene que estar activo para poder suscribir
const registro = () => navigator.serviceWorker.ready;

export const suscripcionActual = async () => {
  if (!soportado()) return null;
  try {
    return await (await registro()).pushManager.getSubscription();
  } catch {
    //! Sin service worker registrado (por ejemplo, en desarrollo) no hay nada
    return null;
  }
};

//! Suscribe este aparato. Lanza si la persona no da permiso: el mensaje lo
//! pone quien llama.
export const suscribir = async (clavePublica) => {
  const actual = await suscripcionActual();
  if (actual) return actual;

  const servicio = await registro();
  return servicio.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: aBytes(clavePublica),
  });
};

//! Apaga los avisos en este aparato (devuelve la suscripción que había)
export const quitar = async () => {
  const actual = await suscripcionActual();
  if (actual) await actual.unsubscribe();
  return actual;
};
