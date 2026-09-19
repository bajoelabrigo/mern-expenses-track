import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

//! Cuánto tiempo se conservan en el dispositivo los datos ya vistos
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

//! Cambiar esta cadena descarta las cachés guardadas (p. ej. si cambia la
//! forma de las respuestas de la API)
export const CACHE_BUSTER = "v1";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      //! Los 401 no se reintentan: el interceptor ya redirige al login
      retry: (failureCount, error) =>
        error?.response?.status === 401 ? false : failureCount < 2,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
      //! Debe ser >= CACHE_MAX_AGE o los datos se borrarían de memoria antes de
      //! poder restaurarlos al volver a abrir la app
      gcTime: CACHE_MAX_AGE,
    },
  },
});

//! Datos vistos guardados en el dispositivo: la app abre al instante y sin
//! conexión con lo último que se cargó (también mientras Render despierta).
//! Al cerrar sesión se vacía la caché (queryClient.clear en la barra) y con
//! ella lo guardado.
export const persister = (() => {
  try {
    //! Acceder a localStorage puede lanzar (modo privado, datos bloqueados)
    window.localStorage.getItem("probe");
    return createSyncStoragePersister({
      storage: window.localStorage,
      key: "cg-cache",
      throttleTime: 1000,
    });
  } catch {
    return null;
  }
})();

//! Solo se guardan las consultas que terminaron bien; las del panel de
//! administración no (son de la plataforma entera y se piden al momento).
export const shouldPersistQuery = (query) =>
  query.state.status === "success" && !String(query.queryKey[0]).startsWith("admin-");
