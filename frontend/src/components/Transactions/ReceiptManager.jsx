import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FaPaperclip } from "react-icons/fa";
import {
  attachReceiptAPI,
  removeReceiptAPI,
} from "../../services/transactions/transactionService";
import { getErrorMessage } from "../../lib/axios";
import { useOnline } from "../../hooks/useOnline";
import AlertMessage from "../Alert/AlertMessage";
import ReceiptPicker from "./ReceiptPicker";
import { formatBytes, openReceipt } from "./receipt";

//! Comprobante de un movimiento ya guardado: ver, reemplazar o quitar
const ReceiptManager = ({ transaction, canWrite }) => {
  const queryClient = useQueryClient();
  const online = useOnline();
  const [file, setFile] = useState(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["transaction", transaction._id] });
    queryClient.invalidateQueries({ queryKey: ["list-transactions"] });
  };

  const upload = useMutation({
    mutationFn: attachReceiptAPI,
    onSuccess: () => {
      setFile(null);
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: removeReceiptAPI, onSuccess: refresh });

  const receipt = transaction.receipt;
  const error = upload.error || remove.error;

  return (
    <section className="space-y-3">
      <h3 className="flex gap-2 items-center text-gray-700 font-medium">
        <FaPaperclip className="text-blue-500" /> Comprobante
      </h3>

      {error && <AlertMessage type="error" message={getErrorMessage(error)} />}
      {upload.isSuccess && <AlertMessage type="success" message="Comprobante guardado" />}

      {receipt ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-gray-700">
            {receipt.format === "pdf" ? "PDF" : "Foto"} · {formatBytes(receipt.bytes)}
          </span>
          <button
            type="button"
            onClick={() => openReceipt(transaction._id)}
            className="text-blue-600 hover:underline"
          >
            Ver
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("¿Quitar el comprobante? Se borra y no se puede recuperar.")) {
                  remove.mutate(transaction._id);
                }
              }}
              disabled={remove.isPending}
              className="text-red-600 hover:underline"
            >
              Quitar
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Este movimiento no tiene comprobante.</p>
      )}

      {canWrite && !transaction.voided && (
        <>
          <ReceiptPicker
            value={file}
            onChange={setFile}
            label={receipt ? "Reemplazar el comprobante" : "Adjuntar comprobante"}
            disabled={upload.isPending}
          />
          {file && (
            <button
              type="button"
              onClick={() => upload.mutate({ id: transaction._id, file })}
              disabled={upload.isPending || !online}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm disabled:opacity-60"
            >
              {upload.isPending ? "Subiendo..." : online ? "Guardar comprobante" : "Sin conexión"}
            </button>
          )}
        </>
      )}
    </section>
  );
};

export default ReceiptManager;
