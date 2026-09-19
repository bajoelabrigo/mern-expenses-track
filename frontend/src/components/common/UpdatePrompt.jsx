import { useRegisterSW } from "virtual:pwa-register/react";

//! Cada cuánto se comprueba si hay una versión nueva con la app abierta (una
//! PWA instalada puede pasar días sin recargarse)
const CHECK_EVERY_MS = 60 * 60 * 1000;

//! Registra el service worker y avisa cuando hay una versión nueva. No recarga
//! sola: podría perderse un formulario a medio llenar.
const UpdatePrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        //! Sin conexión no tiene sentido buscar actualizaciones
        if (navigator.onLine) registration.update().catch(() => {});
      }, CHECK_EVERY_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-50 bg-white border border-blue-200 shadow-lg rounded-lg p-4 flex flex-wrap items-center gap-3"
    >
      <p className="text-sm text-gray-800 flex-1 min-w-[12rem]">
        Hay una versión nueva de la app.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-300"
        >
          Más tarde
        </button>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
};

export default UpdatePrompt;
