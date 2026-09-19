import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuBan, LuTrash2, LuUndo2 } from "react-icons/lu";
import {
  fetchTransactionByIdAPI,
  purgeTransactionAPI,
  restoreTransactionAPI,
  voidTransactionAPI,
} from "../../services/transactions/transactionService";
import { getErrorMessage } from "../../lib/axios";
import { useWorkspace } from "../../hooks/useWorkspace";
import { Card, Notice } from "../ui";
import AlertMessage from "../Alert/AlertMessage";
import TransactionForm from "./TransactionForm";
import ReceiptManager from "./ReceiptManager";

//! Acciones de un movimiento guardado: comprobante, anular/restaurar y borrar
const TransactionActions = ({ transaction }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useWorkspace();
  const canWrite = can("tx:write");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["transaction", transaction._id] });
    queryClient.invalidateQueries({ queryKey: ["list-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const voidMutation = useMutation({ mutationFn: voidTransactionAPI, onSuccess: refresh });
  const restoreMutation = useMutation({ mutationFn: restoreTransactionAPI, onSuccess: refresh });
  const purgeMutation = useMutation({
    mutationFn: purgeTransactionAPI,
    onSuccess: () => {
      refresh();
      navigate("/movimientos", { replace: true });
    },
  });
  const error = [voidMutation, restoreMutation, purgeMutation].find((m) => m.isError)?.error;

  //! Anular es lo normal: la fila queda tachada con su motivo y deja de sumar
  const handleVoid = () => {
    const reason = window.prompt("¿Por qué anulas este movimiento? (queda en el historial)", "");
    if (reason === null) return;
    voidMutation.mutate({ id: transaction._id, reason });
  };

  //! Borrar del todo es para lo que nunca fue dinero (una prueba, un duplicado)
  const handlePurge = () => {
    const ok = window.confirm(
      "¿Borrar definitivamente? Úsalo solo para pruebas o duplicados: no se puede deshacer. Lo normal es anular."
    );
    if (ok) purgeMutation.mutate(transaction._id);
  };

  return (
    <div className="space-y-4 pt-2">
      {error && <AlertMessage type="error" message={getErrorMessage(error)} />}

      <Card className="p-4">
        <ReceiptManager transaction={transaction} canWrite={canWrite} />
      </Card>

      {canWrite && (
        <div className="flex flex-col gap-2">
          {transaction.voided ? (
            <button
              type="button"
              onClick={() => restoreMutation.mutate(transaction._id)}
              disabled={restoreMutation.isPending}
              className="h-12 rounded-card bg-surface shadow-card font-semibold text-ink inline-flex items-center justify-center gap-2"
            >
              <LuUndo2 aria-hidden="true" /> Restaurar movimiento
            </button>
          ) : (
            <button
              type="button"
              onClick={handleVoid}
              disabled={voidMutation.isPending}
              className="h-12 rounded-card bg-surface shadow-card font-semibold text-ink inline-flex items-center justify-center gap-2"
            >
              <LuBan aria-hidden="true" /> Anular movimiento
            </button>
          )}
          {can("tx:purge") && (
            <button
              type="button"
              onClick={handlePurge}
              disabled={purgeMutation.isPending}
              className="h-11 rounded-card font-semibold text-danger inline-flex items-center justify-center gap-2 hover:bg-danger-soft"
            >
              <LuTrash2 aria-hidden="true" /> Borrar definitivamente
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const TransactionUpdate = () => {
  const { id } = useParams();
  const { data: transaction, isLoading, isError, error } = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => fetchTransactionByIdAPI(id),
    enabled: Boolean(id),
  });

  if (isLoading) return <AlertMessage type="loading" message="Cargando movimiento…" />;
  if (isError) return <AlertMessage type="error" message={getErrorMessage(error)} />;

  return (
    <>
      {transaction.voided && (
        <Notice tone="warning" className="max-w-md mx-auto mb-4">
          Este movimiento está anulado
          {transaction.voidReason ? `: ${transaction.voidReason}` : ""}. No suma en los totales.
        </Notice>
      )}
      {/* key: al restaurar o recargar, el formulario toma los datos nuevos */}
      <TransactionForm key={`${transaction._id}-${transaction.updatedAt}`} transaction={transaction}>
        <TransactionActions transaction={transaction} />
      </TransactionForm>
    </>
  );
};

export default TransactionUpdate;
