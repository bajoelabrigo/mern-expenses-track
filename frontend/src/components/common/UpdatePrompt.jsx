import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "../ui";

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
      className="fixed bottom-24 lg:bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-50 bg-surface shadow-card rounded-card p-4 flex flex-wrap items-center gap-3"
    >
      <p className="text-sm font-semibold text-ink flex-1 min-w-[12rem]">
        Hay una versión nueva de la app.
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
          Más tarde
        </Button>
        <Button size="sm" onClick={() => updateServiceWorker(true)}>
          Actualizar
        </Button>
      </div>
    </div>
  );
};

export default UpdatePrompt;
