import { useOutbox, useOutboxActions } from "../../hooks/useOutbox";
import { removeFromOutbox } from "../../lib/outbox";
import { formatMoney } from "../../lib/money";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useOnline } from "../../hooks/useOnline";

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
    <section className="mb-4 p-4 rounded-lg border border-amber-200 bg-amber-50">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-semibold text-amber-900">
          Por enviar ({items.length})
        </h3>
        {online && (
          <button
            type="button"
            onClick={sync}
            className="text-sm text-blue-700 hover:underline"
          >
            Enviar ahora
          </button>
        )}
      </div>
      <p className="text-xs text-amber-800 mb-3">
        Guardados en este dispositivo. Se envían solos al volver la conexión.
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="bg-white rounded-md border border-amber-100 p-2 flex flex-wrap items-center justify-between gap-2"
          >
            <div className="text-sm">
              <span className="text-gray-600">
                {new Date(item.payload.date).toLocaleDateString("es-PE")}
              </span>{" "}
              <span className="capitalize">{item.payload.category}</span>{" "}
              <span className="font-semibold">
                {item.payload.type === "expense" ? "−" : "+"}
                {formatMoney(item.payload.amount, currency)}
              </span>
              {item.status === "failed" && (
                <p className="text-xs text-red-700 mt-1">No se pudo guardar: {item.error}</p>
              )}
            </div>
            <div className="flex gap-3 text-sm">
              {item.status === "failed" && (
                <button
                  type="button"
                  onClick={() => retry(item.id)}
                  className="text-blue-700 hover:underline"
                >
                  Reintentar
                </button>
              )}
              <button
                type="button"
                onClick={() => discard(item)}
                className="text-red-600 hover:underline"
              >
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
