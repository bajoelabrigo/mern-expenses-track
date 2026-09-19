import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

//! Error de red: la petición no obtuvo respuesta (sin internet, servidor caído
//! o despertando). Un 4xx/5xx sí es una respuesta y no cuenta.
export const isNetworkError = (error) => Boolean(error) && !error.response;

//! ¿Responde la API? navigator.onLine solo dice si hay red, no si el servidor
//! contesta (wifi sin salida a internet, Render dormido). Se deduce de las
//! consultas: la última que terminó decide.
export const useApiReachable = () => {
  const queryClient = useQueryClient();
  const [reachable, setReachable] = useState(true);

  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== "updated" || event.action?.type === "fetch") return;
        const { status, error } = event.query.state;
        if (status === "success") setReachable(true);
        else if (status === "error" && isNetworkError(error)) setReachable(false);
      }),
    [queryClient]
  );

  return reachable;
};

export default useApiReachable;
