//! URL base de la API.
//! Se configura con VITE_API_URL (ver .env.example). Si no está definida se usa
//! localhost en desarrollo y una ruta relativa en producción (mismo dominio).
const fallback = import.meta.env.DEV ? "http://localhost:8000/api/v1" : "/api/v1";

export const BASE_URL = import.meta.env.VITE_API_URL || fallback;
