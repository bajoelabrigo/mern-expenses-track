import { useOutbox, useOutboxActions } from "../../hooks/useOutbox";
import { removeFromOutbox } from "../../lib/outbox";
import { formatMoney } from "../../lib/money";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useOnline } from "../../hooks/useOnline";
import { LuCloudUpload } from "react-icons/lu";
import { capitalize } from "../ui/styles";


//! Movimientos registrados sin conexión que aún no llegaron al servidor, en el
//! espacio actual. Los fallidos (el servidor los rechazó) se pueden
//! reintentar o descartar; los pendientes se envían solos.
const PendingTransactions = () => {
  const { workspace, currency } = useWorkspace();
  const items = useOutbox(workspace?._id);
  const { sync, retry } = useOutboxActions();
  const online = useOnline();

  if (items.length === 0) return null;

  const discard = (item) => {
    const ok = window.confirm(
      "¿Descartar este movimiento? Nunca llegó al servidor: se perderá."
    );
    if (ok) removeFromOutbox(item.id);
  };

  return (
    <section className="mb-4 rounded-card bg-accent-soft p-4" aria-label="Por enviar">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-extrabold text-ink inline-flex items-center gap-2">
          <LuCloudUpload aria-hidden="true" /> Por enviar ({items.length})
        </h2>
        {online && (
          <button type="button" onClick={sync} className="text-sm font-semibold text-ink underline underline-offset-4">
            Enviar ahora
          </button>
        )}
      </div>
      <p className="text-xs text-ink-2 mt-1 mb-3">
        Guardados en este teléfono. Se envían solos al volver la conexión.
      </p>
      <ul className="bg-surface rounded-2xl divide-y divide-line overflow-hidden">
        {items.map((item) => (
          <li key={item.id} className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm min-w-0">
              <p className="font-semibold text-ink truncate">
                {item.payload.description || capitalize(item.payload.category)}
              </p>
              <p className="text-xs text-muted">
                {new Date(item.payload.date).toLocaleDateString("es", { day: "numeric", month: "short" })} ·{" "}
                {capitalize(item.payload.category)}
              </p>
              {item.status === "failed" && (
                <p className="text-xs font-semibold text-danger mt-1">No se pudo guardar: {item.error}</p>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className={`font-bold tabular ${item.payload.type === "income" ? "text-income" : "text-ink"}`}>
                {item.payload.type === "expense" ? "−" : "+"}
                {formatMoney(item.payload.amount, currency)}
              </span>
              {item.status === "failed" && (
                <button type="button" onClick={() => retry(item.id)} className="font-semibold text-ink underline">
                  Reintentar
                </button>
              )}
              <button type="button" onClick={() => discard(item)} className="font-semibold text-danger">
                Descartar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PendingTransactions;
