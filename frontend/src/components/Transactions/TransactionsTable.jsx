import { Link } from "react-router-dom";
import { LuPaperclip, LuRepeat } from "react-icons/lu";
import { formatMoney, fromCents } from "../../lib/money";
import { dayLabel } from "../../lib/periods";
import { groupByDay } from "./groupByDay";
import { CategoryIcon, Money } from "../ui";
import { capitalize, cx } from "../ui/styles";

const tableDate = (value) =>
  new Date(value).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });

//! Estado del movimiento: lo que el tesorero necesita ver de un vistazo
const Status = ({ transaction }) => {
  const tags = [];
  if (transaction.voided) {
    tags.push(
      <span key="v" className="px-2 py-0.5 rounded-full bg-danger-soft text-danger" title={transaction.voidReason || undefined}>
        Anulado
      </span>
    );
  }
  if (transaction.receipt) {
    tags.push(
      <span key="r" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2 text-ink-2">
        <LuPaperclip aria-hidden="true" /> Comprobante
      </span>
    );
  }
  if (transaction.recurrent) {
    tags.push(
      <span key="c" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2 text-ink-2">
        <LuRepeat aria-hidden="true" /> Recurrente
      </span>
    );
  }
  return tags.length ? <div className="flex flex-wrap gap-1.5 text-xs font-semibold">{tags}</div> : null;
};

const Row = ({ transaction: t, icon, currency, href, showDate }) => {
  const title = t.description || capitalize(t.category);
  const struck = t.voided ? "line-through text-muted" : "text-ink";
  return (
    //! La fila entera es clicable: el enlace del concepto se estira sobre ella
    <tr className={cx("relative", href && "hover:bg-surface-2 transition")}>
      <td className="py-3 pl-5 pr-3">
        <div className="flex items-center gap-3 min-w-0">
          <CategoryIcon name={t.category} icon={icon} size="sm" />
          <div className="min-w-0">
            {href ? (
              <Link
                to={href}
                className={cx("block font-semibold truncate after:absolute after:inset-0", struck)}
              >
                {title}
              </Link>
            ) : (
              <p className={cx("font-semibold truncate", struck)}>{title}</p>
            )}
            {(t.description || t.fund?.name || t.donor?.name) && (
              <p className="text-xs text-muted truncate">
                {[
                  t.description && capitalize(t.category),
                  t.fund?.name && `${t.fund.icon || ""} ${t.fund.name}`.trim(),
                  t.donor?.name,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
      </td>
      {showDate && <td className="py-3 px-3 text-sm text-ink-2 whitespace-nowrap tabular">{tableDate(t.date)}</td>}
      <td className="hidden xl:table-cell py-3 px-3 text-sm text-ink-2 truncate">{t.createdBy?.username || "—"}</td>
      <td className="py-3 px-3">
        <Status transaction={t} />
      </td>
      <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
        <Money
          amount={t.amount}
          currency={currency}
          type={t.type}
          signed
          className={t.voided ? "line-through opacity-50" : ""}
        />
      </td>
    </tr>
  );
};

//! Tabla de movimientos para pantallas grandes (en el móvil va la lista).
//! `grouped`: filas agrupadas por día con el neto del día, como en la lista.
const TransactionsTable = ({ transactions, iconOf, currency, hrefOf, grouped, caption }) => {
  const showDate = !grouped;
  const columns = showDate ? 5 : 4;
  const groups = grouped ? groupByDay(transactions) : [{ key: "all", items: transactions }];

  return (
    <div className="bg-surface rounded-card shadow-card overflow-hidden">
      <table className="w-full table-fixed text-left">
        {caption && <caption className="sr-only">{caption}</caption>}
        <colgroup>
          <col />
          {showDate && <col className="w-32" />}
          <col className="hidden xl:table-column w-36" />
          <col className="w-44 xl:w-56" />
          <col className="w-36" />
        </colgroup>
        <thead>
          <tr className="text-xs font-bold text-muted border-b border-line">
            <th scope="col" className="py-3 pl-5 pr-3 font-bold">Concepto</th>
            {showDate && <th scope="col" className="py-3 px-3 font-bold">Fecha</th>}
            <th scope="col" className="hidden xl:table-cell py-3 px-3 font-bold">Registró</th>
            <th scope="col" className="py-3 px-3 font-bold">Estado</th>
            <th scope="col" className="py-3 pl-3 pr-5 font-bold text-right">Monto</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.key} className="divide-y divide-line [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
            {grouped && (
              <tr className="bg-surface-2/60">
                <th scope="colgroup" colSpan={columns - 1} className="py-2 pl-5 pr-3 text-xs font-bold text-muted">
                  {dayLabel(group.date)}
                </th>
                <td className={cx("py-2 pl-3 pr-5 text-right text-xs font-bold tabular", group.net >= 0 ? "text-income" : "text-muted")}>
                  {group.net >= 0 ? "+" : "−"}
                  {formatMoney(Math.abs(fromCents(group.net)), currency)}
                </td>
              </tr>
            )}
            {group.items.map((t) => (
              <Row
                key={t._id}
                transaction={t}
                icon={iconOf(t.category)}
                currency={currency}
                href={hrefOf?.(t)}
                showDate={showDate}
              />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
};

export default TransactionsTable;
