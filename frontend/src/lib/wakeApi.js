import { BASE_URL } from "../utils/url";

//! URL del health check a partir de la URL base de la API
//! (https://api.ejemplo.com/api/v1 -> https://api.ejemplo.com/health)
export const getHealthUrl = () => {
  try {
    const url = new URL(BASE_URL, window.location.origin);
    url.pathname = "/health";
    url.search = "";
    return url.toString();
  } catch {
    return "/health";
  }
};

//! En hosting gratuito (Render, Fly...) el servicio se duerme tras un rato de
//! inactividad y la primera petición tarda casi un minuto en responder.
//! Esta llamada se lanza al abrir la web, así el servidor va despertando
//! mientras la persona lee la portada o escribe sus credenciales.
export const wakeApi = () => {
  try {
    fetch(getHealthUrl(), { method: "GET", cache: "no-store" }).catch(() => {
      //! Si falla no importa: es solo un empujón para despertar el servicio
    });
  } catch {
    // fetch no disponible (entorno sin red)
  }
};
