import { Link } from "react-router-dom";
import { LuBell } from "react-icons/lu";
import { useAvisos } from "../../hooks/useAvisos";
import { cx } from "../ui/styles";

//! El número de avisos sin ver. Se pinta en la campana y en la sección del menú.
export const AvisosContador = ({ unread, className = "" }) => {
  if (!unread) return null;
  return (
    <span
      className={cx(
        "ml-auto min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-accent text-accent-ink text-[11px] font-bold tabular",
        className
      )}
      aria-label={`${unread} sin ver`}
    >
      {unread > 9 ? "9+" : unread}
    </span>
  );
};

//! Campana del encabezado, con el contador de lo que no se ha visto.
//! El texto para lectores de pantalla dice el número: un puntito de color no
//! comunica nada a quien no lo ve.
const AvisosBell = ({ className = "" }) => {
  const { unread } = useAvisos();

  return (
    <Link
      to="/avisos"
      aria-label={unread ? `Avisos, ${unread} sin ver` : "Avisos"}
      className={cx(
        "relative h-10 w-10 shrink-0 grid place-items-center rounded-full bg-surface shadow-card text-ink-2 hover:text-ink transition",
        className
      )}
    >
      <LuBell aria-hidden="true" className="text-xl" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-accent text-accent-ink text-[11px] font-bold tabular"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
};

export default AvisosBell;
