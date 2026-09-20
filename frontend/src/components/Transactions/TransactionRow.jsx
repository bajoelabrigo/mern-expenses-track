import { Link } from "react-router-dom";
import { LuCalendarClock, LuPaperclip } from "react-icons/lu";
import { CategoryIcon, Money } from "../ui";
import { capitalize } from "../ui/styles";
import { isScheduled } from "../../lib/periods";


//! Una fila del libro: ícono de la categoría, concepto, detalle e importe.
//! Toda la fila lleva a editar (si se puede) o al detalle.
const TransactionRow = ({ transaction, icon, currency, href, actions }) => {
  const title = transaction.description || capitalize(transaction.category);
  //! En el listado el fondo llega con su nombre; el General no se menciona
  const fundLabel = transaction.fund?.name ? `${transaction.fund.icon || ""} ${transaction.fund.name}`.trim() : null;
  const detail = [
    capitalize(transaction.category),
    fundLabel,
    //! El nombre solo llega a quien puede verlo (lo filtra la API)
    transaction.donor?.name,
    transaction.createdBy?.username ? `por ${transaction.createdBy.username}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const content = (
    <>
      <CategoryIcon name={transaction.category} icon={icon} />
      <div className="min-w-0 flex-1">
        <p
          className={`font-semibold truncate ${
            transaction.voided ? "line-through text-muted" : "text-ink"
          }`}
        >
          {title}
        </p>
        <p className="text-xs text-muted truncate flex items-center gap-1">
          {transaction.receipt && <LuPaperclip aria-label="Con comprobante" className="shrink-0" />}
          {isScheduled(transaction.date) && !transaction.voided && (
            <span className="inline-flex items-center gap-1 text-ink-2 font-semibold">
              <LuCalendarClock aria-hidden="true" /> Programado ·
            </span>
          )}
          {transaction.voided
            ? `Anulado${transaction.voidReason ? `: ${transaction.voidReason}` : ""}`
            : detail}
        </p>
      </div>
      <Money
        amount={transaction.amount}
        currency={currency}
        type={transaction.type}
        signed
        className={transaction.voided ? "line-through opacity-50" : ""}
      />
    </>
  );

  const rowClass = "flex items-center gap-3 px-4 py-3";

  return (
    <li className="relative">
      {href ? (
        <Link to={href} className={`${rowClass} hover:bg-surface-2 transition`}>
          {content}
        </Link>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
      {actions}
    </li>
  );
};

export default TransactionRow;
