import { Link } from "react-router-dom";
import { fundKey, useFunds } from "../../hooks/useFunds";
import { formatMoney } from "../../lib/money";
import { cx } from "../ui/styles";
import { GoalBar } from "./FundBits";

const MAX_FUNDS = 6;

//! Tarjeta oscura del Inicio: el saldo de cada fondo y el avance de las metas.
//! No aparece si el espacio solo tiene el General.
const FundsSummaryCard = ({ currency, className = "" }) => {
  const { activeFunds, hasFunds } = useFunds();
  if (!hasFunds) return null;
  const shown = activeFunds.slice(0, MAX_FUNDS);

  return (
    <section
      aria-labelledby="fondos-resumen"
      className={cx(
        "rounded-card p-5 bg-ink text-surface dark:bg-surface-2 dark:text-ink dark:ring-1 dark:ring-line",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 id="fondos-resumen" className="font-extrabold">
          Fondos
        </h2>
        <Link
          to="/fondos"
          className="text-sm font-semibold text-surface/70 hover:text-surface dark:text-muted dark:hover:text-ink"
        >
          Ver todos
        </Link>
      </div>
      <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
        {shown.map((fund) => (
          <li key={fundKey(fund)}>
            <Link to={`/fondos/${fundKey(fund)}`} className="block group">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="text-lg">
                  {fund.icon}
                </span>
                <span className="flex-1 min-w-0 truncate font-semibold group-hover:underline underline-offset-4">
                  {fund.name}
                </span>
                <span className={cx("tabular font-bold", fund.balance < 0 && "text-danger")}>
                  {formatMoney(fund.balance, currency)}
                </span>
              </div>
              <GoalBar fund={fund} currency={currency} tone="dark" className="mt-2 pl-8" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default FundsSummaryCard;
