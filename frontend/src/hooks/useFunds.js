import { useQuery } from "@tanstack/react-query";
import { listFundsAPI } from "../services/funds/fundService";

//! Bajo "transactions": registrar, anular o sincronizar un movimiento ya
//! invalida ["transactions"], y con eso se refrescan los saldos de los fondos
export const FUNDS_KEY = ["transactions", "funds"];
export const TRANSFERS_KEY = ["transactions", "fund-transfers"];

//! Clave de un fondo en la URL y en los filtros: su id o "general"
export const fundKey = (fund) => (fund?._id ? fund._id : "general");

export const useFunds = () => {
  const query = useQuery({ queryKey: FUNDS_KEY, queryFn: listFundsAPI });
  const funds = query.data || [];
  return {
    ...query,
    funds,
    //! Los que se ofrecen al registrar (el General siempre, sin archivados)
    activeFunds: funds.filter((f) => !f.archived),
    //! ¿Usa fondos este espacio? (además del General)
    hasFunds: funds.some((f) => !f.general),
    findFund: (key) => funds.find((f) => fundKey(f) === (key || "general")),
  };
};

export default useFunds;
