import { getReceiptUrlAPI } from "../../services/transactions/transactionService";
import { getErrorMessage } from "../../lib/axios";

//! Abre el comprobante en una pestaña nueva. La ventana se abre YA, en el
//! mismo toque: si se abriera después de esperar a la API, el navegador la
//! bloquearía como ventana emergente.
export const openReceipt = async (transactionId) => {
  const win = window.open("", "_blank");
  try {
    const { url } = await getReceiptUrlAPI(transactionId);
    if (win) {
      //! Sin acceso de vuelta a la app desde la pestaña del comprobante
      win.opener = null;
      win.location.href = url;
    } else {
      window.location.assign(url);
    }
  } catch (error) {
    win?.close();
    window.alert(getErrorMessage(error, "No se pudo abrir el comprobante"));
  }
};

//! "240 KB", "1,2 MB"
export const formatBytes = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es", { maximumFractionDigits: 1 })} MB`;
};
