import { useOnline } from "../../hooks/useOnline";
import { useApiReachable } from "../../hooks/useApiReachable";

//! Aviso fijo mientras no hay conexión o el servidor no responde: lo que se ve
//! son los últimos datos guardados en el dispositivo.
const OfflineBanner = () => {
  const online = useOnline();
  const apiReachable = useApiReachable();

  if (online && apiReachable) return null;

  return (
    <div
      role="status"
      className="bg-accent-soft text-ink text-sm font-medium text-center px-4 py-2"
    >
      {online
        ? "No se pudo conectar con el servidor: ves los últimos datos guardados en este dispositivo."
        : "Sin conexión: ves los últimos datos guardados en este dispositivo."}
    </div>
  );
};

export default OfflineBanner;
