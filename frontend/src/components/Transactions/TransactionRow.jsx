import { Link } from "react-router-dom";
import { LuPaperclip } from "react-icons/lu";
import { CategoryIcon, Money } from "../ui";
import { capitalize } from "../ui/styles";


//! Una fila del libro: ícono de la categoría, concepto, detalle e importe.
//! Toda la fila lleva a editar (si se puede) o al detalle.
const TransactionRow = ({ transaction, icon, currency, href, actions }) => {
  const title = transaction.description || capitalize(transaction.category);
  const detail = [
    capitalize(transaction.category),
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
