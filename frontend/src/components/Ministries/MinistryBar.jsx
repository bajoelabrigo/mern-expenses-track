import { LuTriangleAlert } from "react-icons/lu";
import { formatMoney } from "../../lib/money";
import { cx } from "../ui/styles";

//! El avance del presupuesto de un ministerio.
//!
//! Al 80 % se pinta en ámbar y al 100 % en rojo, pero la app NO bloquea el
//! gasto: quién autoriza pasarse del presupuesto lo decide la iglesia, no un
//! programa. Lo que hace la app es que nadie pueda decir que no lo sabía.
const MinistryBar = ({ ministry, currency }) => {
  const { percent, spent, budget, remaining, warning, exceeded } = ministry;

  //! Sin presupuesto no hay avance que mostrar, solo lo gastado
  if (percent === null) {
    return (
      <p className="text-sm text-muted">
        Sin presupuesto. Lleva gastado {formatMoney(spent, currency)}.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-ink">
          {formatMoney(spent, currency)}{" "}
          <span className="font-normal text-muted">de {formatMoney(budget, currency)}</span>
        </span>
        <span
          className={cx(
            "text-sm font-extrabold tabular",
            exceeded ? "text-danger" : warning ? "text-expense" : "text-muted"
          )}
        >
          {percent}%
        </span>
      </div>

      <div
        className="mt-2 h-2 rounded-full bg-surface-2 overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Avance del presupuesto de ${ministry.name}`}
      >
        <div
          className={cx(
            "h-full rounded-full transition-all",
            exceeded ? "bg-danger" : warning ? "bg-expense" : "bg-income"
          )}
          //! Pasado del 100 %, la barra se queda llena: el exceso se dice aparte
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>

      <p
        className={cx(
          "mt-2 text-sm inline-flex items-center gap-1.5",
          exceeded ? "text-danger font-semibold" : warning ? "text-expense" : "text-muted"
        )}
      >
        {(warning || exceeded) && <LuTriangleAlert aria-hidden="true" className="shrink-0" />}
        {exceeded
          ? `Se pasó por ${formatMoney(Math.abs(remaining), currency)}`
          : warning
          ? `Quedan ${formatMoney(remaining, currency)}: queda poco`
          : `Quedan ${formatMoney(remaining, currency)}`}
      </p>
    </div>
  );
};

export default MinistryBar;
