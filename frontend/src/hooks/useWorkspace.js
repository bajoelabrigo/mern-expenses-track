import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWorkspaceAPI,
  listWorkspacesAPI,
} from "../services/workspaces/workspaceService";
import { setWorkspaceAction } from "../redux/slice/workspaceSlice";

export const WORKSPACES_KEY = ["workspaces"];

//! Al cambiar de espacio se descartan todos los datos en caché (movimientos,
//! categorías, balances...) menos la lista de espacios: son de otro libro.
const resetWorkspaceData = (queryClient) =>
  queryClient.resetQueries({
    predicate: (query) => query.queryKey[0] !== WORKSPACES_KEY[0],
  });

//! Espacio en el que se trabaja, con su rol y permisos.
//!   workspace   -> { _id, name, kind, currency, role, permissions } o null
//!   can(p)      -> ¿el rol permite p? (p. ej. "tx:write")
//!   isSupport   -> el admin de la plataforma está dentro de un espacio ajeno
export const useWorkspace = () => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const user = useSelector((state) => state.auth.user);
  const currentId = useSelector((state) => state.workspace.currentId);
  const isPlatformAdmin = user?.role === "admin";

  const {
    data: workspaces = [],
    isLoading,
    isFetched,
  } = useQuery({
    queryKey: WORKSPACES_KEY,
    queryFn: listWorkspacesAPI,
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });

  const inList = workspaces.find((w) => w._id === currentId) || null;

  //! Un espacio que no está en mi lista solo lo puede abrir el admin (soporte)
  const { data: supportWorkspace } = useQuery({
    queryKey: ["workspace-support", currentId],
    queryFn: () => getWorkspaceAPI(currentId),
    enabled: Boolean(user && isPlatformAdmin && currentId && isFetched && !inList),
  });

  const fallback = workspaces.find((w) => w.isDefault) || workspaces[0] || null;
  const workspace =
    inList || (isPlatformAdmin && currentId ? supportWorkspace || null : fallback);

  //! Sin espacio elegido, o con uno que ya no es mío: se fija el predeterminado
  useEffect(() => {
    if (!user || !isFetched || !fallback) return;
    if (!currentId) {
      dispatch(setWorkspaceAction(fallback._id));
    } else if (!inList && !isPlatformAdmin) {
      dispatch(setWorkspaceAction(fallback._id));
      resetWorkspaceData(queryClient);
    }
  }, [user, isFetched, fallback, currentId, inList, isPlatformAdmin, dispatch, queryClient]);

  const switchWorkspace = useCallback(
    (id) => {
      if (!id || id === currentId) return;
      dispatch(setWorkspaceAction(id));
      resetWorkspaceData(queryClient);
    },
    [currentId, dispatch, queryClient]
  );

  const can = useCallback(
    (permission) => Boolean(workspace?.permissions?.includes(permission)),
    [workspace]
  );

  return {
    workspace,
    workspaces,
    isLoading,
    can,
    switchWorkspace,
    isSupport: Boolean(workspace && !inList),
    currency: workspace?.currency || "USD",
  };
};
