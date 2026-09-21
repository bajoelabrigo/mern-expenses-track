import { useQuery } from "@tanstack/react-query";
import { listMinistriesAPI } from "../services/ministries/ministryService";
import { useWorkspace } from "./useWorkspace";

//! Bajo "transactions": al cargar un gasto a un ministerio cambia su avance,
//! y al invalidar los movimientos se refresca solo
export const MINISTRIES_KEY = ["transactions", "ministerios"];

//! Ministerios del año con su avance (vacío si el rol no los puede ver).
//! Un líder recibe del servidor solo el que lleva.
export const useMinistries = ({ year } = {}) => {
  const { can, workspace } = useWorkspace();
  const canSee =
    (can("ministry:read") || can("ministry:own")) && workspace?.kind === "iglesia";
  //! El líder no ve el libro: para él, esta pantalla es toda la app
  const onlyMine = canSee && !can("ministry:read");

  const query = useQuery({
    queryKey: [...MINISTRIES_KEY, year || "actual"],
    queryFn: () => listMinistriesAPI(year),
    enabled: canSee,
  });

  const ministries = query.data?.ministries || [];
  return {
    ...query,
    canSee,
    onlyMine,
    canManage: can("ministry:manage"),
    year: query.data?.year,
    currency: query.data?.currency || workspace?.currency || "USD",
    ministries,
    //! Los que se ofrecen al registrar un gasto
    activeMinistries: ministries.filter((m) => !m.archived),
  };
};

export default useMinistries;
