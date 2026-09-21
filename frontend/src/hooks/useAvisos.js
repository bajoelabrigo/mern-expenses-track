import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  listNotificationsAPI,
  markNotificationsReadAPI,
} from "../services/notifications/notificationService";
import { useWorkspace } from "./useWorkspace";

export const AVISOS_KEY = ["avisos"];

//! Los avisos del espacio actual y cuántos quedan sin ver.
//!
//! Se refresca solo cada minuto: eso es lo que hace que la campana se entere de
//! un cambio hecho desde otro teléfono sin recargar la app. Al cambiar de
//! espacio se vacía la caché (useWorkspace), así que nunca se ven los avisos de
//! otro libro.
export const useAvisos = () => {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: AVISOS_KEY,
    queryFn: () => listNotificationsAPI(),
    enabled: Boolean(workspace?._id),
    refetchInterval: 60 * 1000,
  });

  const marcarVistos = useCallback(async () => {
    await markNotificationsReadAPI();
    await queryClient.invalidateQueries({ queryKey: AVISOS_KEY });
  }, [queryClient]);

  const items = query.data?.items || [];

  return {
    ...query,
    items,
    unread: query.data?.unread || 0,
    marcarVistos,
  };
};

export default useAvisos;
