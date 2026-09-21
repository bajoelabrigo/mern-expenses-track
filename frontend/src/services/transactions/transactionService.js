import { axiosInstance } from "../../lib/axios";

//! Crear transacción (soporta recurrencia). `clientId` evita duplicados al
//! reenviar lo registrado sin conexión; `workspaceId` fuerza el espacio (el de
//! cuando se registró, aunque ahora se esté en otro).
export const addTransactionAPI = async (
  {
    type,
    category,
    date,
    description,
    amount,
    recurrent,
    recurrenceType,
    recurrenceCount,
    clientId,
    fund,
    donor,
    payee,
    paymentKind,
    ministry,
  },
  { workspaceId } = {}
) => {
  const response = await axiosInstance.post(
    "/transactions/create",
    {
      type,
      category,
      date,
      amount,
      description,
      recurrent,
      recurrenceType,
      recurrenceCount,
      clientId,
      fund,
      donor,
      payee,
      paymentKind,
      ministry,
    },
    workspaceId ? { headers: { "X-Workspace-Id": workspaceId } } : undefined
  );
  return response.data;
};

//! Actualizar transacción
export const updateTransactionAPI = async ({
  type,
  category,
  amount,
  date,
  description,
  fund,
  donor,
  payee,
  paymentKind,
  ministry,
  id,
}) => {
  const response = await axiosInstance.put(`/transactions/update/${id}`, {
    type,
    category,
    amount,
    date,
    description,
    fund,
    donor,
    payee,
    paymentKind,
    ministry,
  });
  return response.data;
};

//! Anular: la fila se sigue viendo (tachada, con su motivo) y deja de sumar
export const voidTransactionAPI = async ({ id, reason }) => {
  const response = await axiosInstance.post(`/transactions/${id}/void`, { reason });
  return response.data;
};

//! Deshacer una anulación
export const restoreTransactionAPI = async (id) => {
  const response = await axiosInstance.post(`/transactions/${id}/restore`);
  return response.data;
};

//! Borrado definitivo (solo propietario): para pruebas o duplicados
export const purgeTransactionAPI = async (id) => {
  const response = await axiosInstance.delete(`/transactions/${id}/purge`);
  return response.data;
};

//! Listado paginado con filtros
export const listTransationsAPI = async ({
  category,
  type,
  startDate,
  endDate,
  page,
  limit,
  includeVoided,
  q,
  recurrent,
  fund,
  donor,
  payee,
}) => {
  const response = await axiosInstance.get("/transactions/lists", {
    params: {
      q: q || undefined,
      fund: fund || undefined,
      donor: donor || undefined,
      payee: payee || undefined,
      recurrent: recurrent ? "true" : undefined,
      category,
      type,
      startDate,
      endDate,
      page,
      limit,
      includeVoided: includeVoided ? "true" : undefined,
    },
  });
  return response.data;
};

//! Una transacción por id
export const fetchTransactionByIdAPI = async (id) => {
  if (!id) throw new Error("El id de la transacción es obligatorio");
  const response = await axiosInstance.get(`/transactions/${id}`);
  return response.data;
};

//! Transacciones por período o rango personalizado
export const getTransactionByPeriodAPI = async ({
  period,
  type,
  category,
  startDate,
  endDate,
}) => {
  const response = await axiosInstance.get("/transactions/period", {
    params: { period, type, category, startDate, endDate },
  });
  return response.data;
};

//! Balance (ingresos, gastos y saldo) con los mismos filtros del listado
export const getBalanceAPI = async ({ startDate, endDate, type, category } = {}) => {
  const response = await axiosInstance.get("/transactions/balance", {
    params: { startDate, endDate, type, category },
  });
  return response.data;
};

//! Resumen del mes en curso
export const getMonthlySummaryAPI = async () => {
  const response = await axiosInstance.get("/transactions/summary/monthly");
  return response.data;
};

//! Ingresos y gastos de cada mes del año, contados en la zona horaria del
//! dispositivo
export const getYearByMonthAPI = async (year) => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await axiosInstance.get("/transactions/summary/by-month", {
    params: { year, tz },
  });
  return response.data;
};

//! Exporta a Excel respetando los filtros y dispara la descarga en el navegador.
//! Devuelve el nombre del archivo generado.
export const exportTransactionExcelAPI = async ({
  startDate,
  endDate,
  type,
  category,
  q,
  recurrent,
  includeVoided,
  fund,
  donor,
  payee,
} = {}) => {
  //! Los mismos filtros que el listado: el Excel es lo que se ve en pantalla
  const response = await axiosInstance.get("/transactions/export/excel", {
    params: {
      startDate,
      endDate,
      type,
      category,
      q: q || undefined,
      recurrent: recurrent ? "true" : undefined,
      includeVoided: includeVoided ? "true" : undefined,
      fund: fund || undefined,
      donor: donor || undefined,
      payee: payee || undefined,
    },
    responseType: "blob",
  });

  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const fileName = `transacciones_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url); // libera memoria

  return fileName;
};

//! Adjuntar o reemplazar el comprobante (foto o PDF)
export const attachReceiptAPI = async ({ id, file, workspaceId }) => {
  const form = new FormData();
  form.append("receipt", file);
  const response = await axiosInstance.put(`/transactions/${id}/receipt`, form, {
    headers: workspaceId ? { "X-Workspace-Id": workspaceId } : undefined,
  });
  return response.data;
};

//! Enlace temporal (5 minutos) para ver el comprobante
export const getReceiptUrlAPI = async (id) => {
  const response = await axiosInstance.get(`/transactions/${id}/receipt`);
  return response.data;
};

export const removeReceiptAPI = async (id) => {
  const response = await axiosInstance.delete(`/transactions/${id}/receipt`);
  return response.data;
};
