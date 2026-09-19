import { useState } from "react";
import { Navigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listAuditAPI } from "../../services/workspaces/workspaceService";
import { useWorkspace } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import { formatMoney } from "../../lib/money";
import { ROLE_LABELS } from "../../lib/roles";
import { dayLabel } from "../../lib/periods";
import AlertMessage from "../Alert/AlertMessage";
import { Button, EmptyState, ListGroup, PageHeader } from "../ui";
import { capitalize, initials } from "../ui/styles";

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
  if (field === "category" || field === "name") return capitalize(String(value));
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
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm rounded-xl bg-surface-2 px-3 py-2">
      {rows.map((field) => (
        <div key={field} className="contents">
          <dt className="text-muted">{FIELD_LABELS[field] || field}</dt>
          <dd className="text-ink break-words">
            {before && after ? (
              <>
                <span className="line-through text-muted">
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

  //! Agrupado por día, como los movimientos
  const days = [];
  for (const entry of entries) {
    const label = dayLabel(entry.createdAt);
    if (days.at(-1)?.label !== label) days.push({ label, entries: [] });
    days.at(-1).entries.push(entry);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Historial"
        subtitle="Quién hizo qué y cuándo. Nadie puede editarlo ni borrarlo."
      />

      <div className="space-y-6">
        {isLoading && <AlertMessage type="loading" message="Cargando historial…" />}
        {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}

        {!isLoading && !isError && entries.length === 0 && (
          <EmptyState title="Todavía no hay cambios">
            Cada movimiento, categoría o miembro que se toque aparecerá aquí.
          </EmptyState>
        )}

        {days.map((day) => (
          <section key={day.label} aria-label={day.label}>
            <h2 className="text-sm font-bold text-muted px-1 mb-2">{day.label}</h2>
            <ListGroup>
              {day.entries.map((entry) => (
                <article key={entry._id} className="px-4 py-3.5 flex gap-3">
                  <span
                    aria-hidden="true"
                    className="h-9 w-9 shrink-0 rounded-full bg-surface-2 grid place-items-center text-xs font-bold text-ink-2"
                  >
                    {initials(entry.actorName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-ink">
                        <strong className="font-semibold">{entry.actorName || "Alguien"}</strong>{" "}
                        {ACTION_LABELS[entry.action] || entry.action}
                      </p>
                      <time dateTime={entry.createdAt} className="shrink-0 text-xs text-muted tabular">
                        {new Date(entry.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                      </time>
                    </div>
                    {entry.note && <p className="text-sm text-ink-2 mt-1">“{entry.note}”</p>}
                    <Changes entry={entry} currency={currency} />
                  </div>
                </article>
              ))}
            </ListGroup>
          </section>
        ))}

        {totalPages > 1 && (
          <nav aria-label="Páginas del historial" className="flex justify-between items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Más recientes
            </Button>
            <span className="text-sm text-muted tabular">
              {page} de {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Más antiguos
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
};

export default AuditPage;
