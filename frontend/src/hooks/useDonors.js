import { useQuery } from "@tanstack/react-query";
import { listDonorsAPI } from "../services/donors/donorService";
import { useWorkspace } from "./useWorkspace";

//! Bajo "transactions": al registrar un aporte se refrescan los totales
export const DONORS_KEY = ["transactions", "donors"];

//! Aportantes del espacio (vacío si el rol no puede verlos)
export const useDonors = ({ year } = {}) => {
  const { can, workspace } = useWorkspace();
  const canSee = can("donor:read") && workspace?.kind === "iglesia";

  const query = useQuery({
    queryKey: [...DONORS_KEY, year || "actual"],
    queryFn: () => listDonorsAPI({ year }),
    enabled: canSee,
  });

  const donors = query.data?.donors || [];
  return {
    ...query,
    canSee,
    year: query.data?.year,
    donors,
    //! Los que se ofrecen al registrar
    activeDonors: donors.filter((d) => !d.archived),
  };
};

export default useDonors;
