import { useState } from "react";
import { Navigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listAuditAPI } from "../../services/workspaces/workspaceService";
import { useWorkspace } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import { formatMoney } from "../../lib/money";
import { ROLE_LABELS } from "../../lib/roles";
import AlertMessage from "../Alert/AlertMessage";

const ACTION_LABELS = {
  "transaction.create": "registró un movimiento",
  "transaction.update": "editó un movimiento",
  "transaction.void": "anuló un movimiento",
  "transaction.restore": "restauró un movimiento",
  "transaction.purge": "borró definitivamente un movimiento",
  "category.create": "creó una categoría",
  "category.update": "editó una categoría",
  "category.delete": "borró una categoría",
  "member.role": "cambió el rol de un miembro",
  "member.remove": "quitó a un miembro",
  "member.leave": "salió del espacio",
  "invitation.create": "invitó a alguien",
  "invitation.revoke": "revocó una invitación",
  "invitation.accept": "se unió al espacio",
  "workspace.create": "creó el espacio",
  "workspace.update": "cambió los ajustes del espacio",
};

const FIELD_LABELS = {
  type: "Tipo",
  category: "Categoría",
  amount: "Monto",
  date: "Fecha",
  description: "Descripción",
  voided: "Anulado",
  voidReason: "Motivo",
  name: "Nombre",
  icon: "Ícono",
  role: "Rol",
  email: "Correo",
  currency: "Moneda",
  kind: "Tipo de espacio",
};

//! Valor legible de un campo del historial
const formatValue = (field, value, currency) => {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "amount") return formatMoney(value, currency);
  if (field === "date") return new Date(value).toLocaleDateString("es");
  if (field === "type") return value === "income" ? "Ingreso" : "Gasto";
  if (field === "role") return ROLE_LABELS[value] || value;
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
};

//! Qué cambió: en una edición, solo los campos distintos; en un alta o baja,
//! los datos que tenía.
const Changes = ({ entry, currency }) => {
  const { before, after } = entry;
  const fields = Object.keys({ ...(before || {}), ...(after || {}) });

  //! En un alta o baja se omiten los campos vacíos o "no anulado": son ruido
  const isEmpty = (v) => v === null || v === undefined || v === "" || v === false;
  const rows =
    before && after
      ? fields.filter((f) => JSON.stringify(before[f]) !== JSON.stringify(after[f]))
      : fields.filter((f) => !isEmpty((after || before)[f]));

  if (rows.length === 0) return null;

  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map((field) => (
        <div key={field} className="contents">
          <dt className="text-gray-500">{FIELD_LABELS[field] || field}</dt>
          <dd className="text-gray-800 break-words">
            {before && after ? (
              <>
                <span className="line-through text-gray-400">
                  {formatValue(field, before[field], currency)}
                </span>{" "}
                → {formatValue(field, after[field], currency)}
              </>
            ) : (
              formatValue(field, (after || before)[field], currency)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
};

const AuditPage = () => {
  const { workspace, can, currency } = useWorkspace();
  const [page, setPage] = useState(1);
  const id = workspace?._id;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["audit", id, page],
    queryFn: () => listAuditAPI({ id, page }),
    enabled: Boolean(id && can("audit:read")),
    placeholderData: keepPreviousData,
  });

  if (!workspace) return <AlertMessage type="loading" message="Cargando espacio..." />;
  if (!can("audit:read")) return <Navigate to="/dashboard" replace />;

  const entries = data?.entries || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="max-w-3xl mx-auto my-8 px-2 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Historial de cambios</h1>
        <p className="text-sm text-gray-500">
          {workspace.name}: quién hizo qué y cuándo. No se puede editar ni borrar.
        </p>
      </div>

      {isLoading && <AlertMessage type="loading" message="Cargando historial..." />}
      {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}

      {!isLoading && entries.length === 0 && (
        <p className="text-gray-500">Todavía no hay cambios registrados.</p>
      )}

      <ul className="space-y-3">
        {entries.map((entry) => (
          <li key={entry._id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <p className="text-gray-800">
              <strong>{entry.actorName || "Alguien"}</strong>{" "}
              {ACTION_LABELS[entry.action] || entry.action}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(entry.createdAt).toLocaleString("es")}
            </p>
            {entry.note && <p className="text-sm text-gray-700 mt-1 italic">{entry.note}</p>}
            <Changes entry={entry} currency={currency} />
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            Más recientes
          </button>
          <span className="text-sm text-gray-600">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            Más antiguos
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditPage;
