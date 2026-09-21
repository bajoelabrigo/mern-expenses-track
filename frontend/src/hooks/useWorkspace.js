import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const user = useSelector((state) => state.auth.user);
  const currentId = useSelector((state) => state.workspace.currentId);

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

  //! Un espacio pedido que no está en mi lista todavía puede ser mío de otra
  //! forma: el administrador de la plataforma entra a cualquiera como soporte.
  //! Antes esto solo se preguntaba si el CLIENTE creía ser admin (user.role), y
  //! con una sesión vieja o mal hidratada un admin aterrizaba en su espacio
  //! personal sin enterarse: la pantalla era la de la iglesia y lo que hiciera
  //! ahí iba a su libro. Ahora se le pregunta siempre a la API, que es la que
  //! decide de verdad.
  const { data: supportWorkspace, isFetching: cargandoSoporte } = useQuery({
    queryKey: ["workspace-support", currentId],
    queryFn: () => getWorkspaceAPI(currentId),
    enabled: Boolean(user && currentId && isFetched && !inList),
    retry: false,
  });

  const fallback = workspaces.find((w) => w.isDefault) || workspaces[0] || null;
  //! Sin espacio pedido se usa el predeterminado; con uno pedido, lo que diga la
  //! API (y mientras contesta, nada: mejor "Cargando…" que otro espacio)
  const workspace = inList || supportWorkspace || (currentId ? null : fallback);

  //! Sin espacio elegido, o con uno que ya no sirve, se fija el predeterminado
  useEffect(() => {
    if (!user || !isFetched || !fallback) return;
    if (!currentId) {
      dispatch(setWorkspaceAction(fallback._id));
      return;
    }
    if (inList || supportWorkspace) return; // el espacio pedido sí sirve
    if (cargandoSoporte) return; // la API todavía no ha contestado

    //! El espacio recordado ya no es tuyo (te sacaron, se borró, o es de otro
    //! sin permiso de soporte). Se abre el predeterminado Y se va al Inicio: no
    //! se puede seguir en una pantalla que era de ese espacio, porque lo que se
    //! registrara ahí acabaría en el libro equivocado sin que nadie lo note.
    dispatch(setWorkspaceAction(fallback._id));
    resetWorkspaceData(queryClient);
    navigate("/dashboard", { replace: true });
  }, [
    user,
    isFetched,
    fallback,
    currentId,
    inList,
    supportWorkspace,
    cargandoSoporte,
    dispatch,
    queryClient,
    navigate,
  ]);

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
