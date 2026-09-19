import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import {
  readOutbox,
  subscribeOutbox,
  syncOutbox,
  updateOutboxItem,
} from "../lib/outbox";
import { addTransactionAPI } from "../services/transactions/transactionService";

const RETRY_EVERY_MS = 30 * 1000;

//! Envía un elemento de la bandeja al espacio en el que se registró
export const sendOutboxItem = (item) =>
  addTransactionAPI({ ...item.payload, clientId: item.id }, { workspaceId: item.workspaceId });

//! Lo pendiente del usuario con sesión (opcionalmente, de un espacio)
export const useOutbox = (workspaceId) => {
  const userId = useSelector((state) => state.auth.user?.id);
  const items = useSyncExternalStore(subscribeOutbox, readOutbox);
  return items.filter(
    (item) => item.userId === userId && (!workspaceId || item.workspaceId === workspaceId)
  );
};

//! Acciones sobre la bandeja, sin efectos automáticos (para botones)
export const useOutboxActions = () => {
  const queryClient = useQueryClient();
  const userId = useSelector((state) => state.auth.user?.id);

  const sync = useCallback(async () => {
    if (!userId || !navigator.onLine) return;
    const sent = await syncOutbox({ userId, send: sendOutboxItem });
    if (sent > 0) {
      //! Lo enviado aparece ya en listas, gráficos y balances
      queryClient.invalidateQueries({ queryKey: ["list-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    }
  }, [queryClient, userId]);

  //! "Reintentar" un fallido: vuelve a pendiente y se envía ya
  const retry = useCallback(
    (id) => {
      updateOutboxItem(id, { status: "pending", error: "" });
      return sync();
    },
    [sync]
  );

  return { sync, retry, userId };
};

//! Envía lo pendiente al abrir la app, al volver la conexión y cada 30 s
//! mientras quede algo. Se monta UNA sola vez (en Layout).
export const useOutboxSync = () => {
  const { sync, userId } = useOutboxActions();

  useEffect(() => {
    if (!userId) return undefined;
    sync();
    window.addEventListener("online", sync);
    const interval = setInterval(() => {
      if (readOutbox().some((i) => i.userId === userId && i.status === "pending")) sync();
    }, RETRY_EVERY_MS);
    return () => {
      window.removeEventListener("online", sync);
      clearInterval(interval);
    };
  }, [sync, userId]);
};
