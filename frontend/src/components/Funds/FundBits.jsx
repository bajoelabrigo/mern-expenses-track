import { Link } from "react-router-dom";
import { formatMoney } from "../../lib/money";
import { fundKey } from "../../hooks/useFunds";
import { Card } from "../ui";
import { cx } from "../ui/styles";

export const FundIcon = ({ fund, size = "md", className = "" }) => (
  <span
    aria-hidden="true"
    className={cx(
      "shrink-0 grid place-items-center rounded-xl bg-surface-2",
      size === "lg" ? "h-14 w-14 text-3xl" : size === "sm" ? "h-9 w-9 text-lg" : "h-11 w-11 text-xl",
      className
    )}
  >
    {fund?.icon || "🏦"}
  </span>
);

//! Avance hacia la meta: lo juntado (ingresos y pases recibidos) sobre la meta.
//! `tone="dark"` para ir sobre la tarjeta oscura del Inicio.
export const GoalBar = ({ fund, currency, tone = "light", className = "" }) => {
  if (!fund?.goal) return null;
  const ratio = Math.max(0, fund.raised / fund.goal);
  const pct = Math.round(ratio * 100);
  const reached = ratio >= 1;
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-label={`Avance de la meta de ${fund.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)}
        className={cx("h-2 rounded-full overflow-hidden", tone === "dark" ? "bg-surface/15 dark:bg-line" : "bg-surface-2")}
      >
        <div
          className={cx("h-full rounded-full", reached ? "bg-income" : "bg-accent")}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
      <p
        className={cx(
          "mt-1.5 flex justify-between gap-2 text-xs font-semibold tabular",
          tone === "dark" ? "text-surface/70 dark:text-muted" : "text-muted"
        )}
      >
        <span>
          {formatMoney(fund.raised, currency)} de {formatMoney(fund.goal, currency)}
        </span>
        <span>{reached ? "¡Meta cumplida!" : `${pct}%`}</span>
      </p>
    </div>
  );
};

//! Tarjeta de un fondo en la lista: saldo grande y, si tiene meta, su avance
export const FundCard = ({ fund, currency }) => (
  <Card
    as={Link}
    to={`/fondos/${fundKey(fund)}`}
    className="p-5 flex flex-col gap-4 hover:ring-2 hover:ring-line transition"
  >
    <div className="flex items-center gap-3 min-w-0">
      <FundIcon fund={fund} />
      <div className="min-w-0">
        <p className="font-bold text-ink truncate">{fund.name}</p>
        <p className="text-sm text-muted truncate">
          {fund.general ? "Lo que no está en otro fondo" : fund.description || "Fondo"}
        </p>
      </div>
    </div>
    <div>
      <p className="text-xs font-semibold text-muted">Saldo</p>
      <p
        className={cx(
          "text-[26px] leading-tight font-extrabold tracking-tight tabular",
          fund.balance < 0 ? "text-danger" : "text-ink"
        )}
      >
        {formatMoney(fund.balance, currency)}
      </p>
    </div>
    <GoalBar fund={fund} currency={currency} />
  </Card>
);
