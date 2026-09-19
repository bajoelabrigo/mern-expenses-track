import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LuArchive,
  LuArchiveRestore,
  LuChevronLeft,
  LuChevronRight,
  LuFileText,
  LuPencil,
  LuTrash2,
} from "react-icons/lu";
import {
  deleteDonorAPI,
  downloadStatementAPI,
  getDonorAPI,
  updateDonorAPI,
} from "../../services/donors/donorService";
import { listTransationsAPI } from "../../services/transactions/transactionService";
import { listCategoriesAPI } from "../../services/category/categoryService";
import { DONORS_KEY } from "../../hooks/useDonors";
import { useWorkspace } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import { formatMoney } from "../../lib/money";
import AlertMessage from "../Alert/AlertMessage";
import { Button, ButtonLink, Card, Notice, PageHeader } from "../ui";
import { initials } from "../ui/styles";
import TransactionRow from "../Transactions/TransactionRow";

const Dato = ({ label, value }) =>
  value ? (
    <div className="flex justify-between gap-3 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-ink text-right break-words">{value}</dd>
    </div>
  ) : null;

//! /aportantes/:id — lo que dio una persona y sus datos
const DonorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { workspace, currency, can } = useWorkspace();
  const [year, setYear] = useState(new Date().getFullYear());
  const canWrite = can("donor:write");
  const thisYear = new Date().getFullYear();

  const donorQuery = useQuery({
    queryKey: [...DONORS_KEY, "uno", id, year],
    queryFn: () => getDonorAPI({ id, year }),
  });
  const gifts = useQuery({
    queryKey: ["list-transactions", "donor", id],
    queryFn: () => listTransationsAPI({ donor: id, page: 1, limit: 20 }),
  });
  const { data: categories = [] } = useQuery({ queryKey: ["list-categories"], queryFn: listCategoriesAPI });
  const iconOf = (name) => categories.find((c) => c.name === name)?.icon;

  const archive = useMutation({
    mutationFn: updateDonorAPI,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DONORS_KEY }),
  });
  const statement = useMutation({ mutationFn: downloadStatementAPI });
  const remove = useMutation({
    mutationFn: deleteDonorAPI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DONORS_KEY });
      navigate("/aportantes", { replace: true });
    },
  });

  if (workspace && !can("donor:read")) return <Navigate to="/dashboard" replace />;
  if (donorQuery.isLoading) return <AlertMessage type="loading" message="Cargando…" />;
  if (donorQuery.isError) {
    return <AlertMessage type="error" message={getErrorMessage(donorQuery.error)} />;
  }

  const donor = donorQuery.data;
  const mutationError = [archive, remove, statement].find((m) => m.isError);
  const handleDelete = () => {
    if (window.confirm(`¿Borrar a ${donor.name}? Nunca se le registró un aporte.`)) remove.mutate(donor._id);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to="/aportantes"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink mb-4"
      >
        <LuChevronLeft aria-hidden="true" /> Aportantes
      </Link>

      <PageHeader
        title={donor.name}
        subtitle={donor.archived ? "Archivado" : "Aportante"}
        action={
          canWrite && (
            <ButtonLink to={`/aportantes/${donor._id}/editar`} variant="secondary" size="sm">
              <LuPencil aria-hidden="true" />
              <span className="hidden sm:inline">Editar</span>
            </ButtonLink>
          )
        }
      />

      <div className="space-y-5">
        {mutationError && <AlertMessage type="error" message={getErrorMessage(mutationError.error)} />}
        {donor.archived && (
          <Notice tone="warning">
            Archivado: no se ofrece al registrar, pero su historial se conserva para las constancias.
          </Notice>
        )}

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-muted">Dio en {year}</p>
            <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1 shrink-0">
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                aria-label="Año anterior"
                className="h-8 w-8 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface"
              >
                <LuChevronLeft aria-hidden="true" />
              </button>
              <span className="px-1 text-sm font-bold tabular" aria-live="polite">
                {year}
              </span>
              <button
                type="button"
                onClick={() => setYear((y) => y + 1)}
                disabled={year >= thisYear}
                aria-label="Año siguiente"
                className="h-8 w-8 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface disabled:opacity-30 disabled:pointer-events-none"
              >
                <LuChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-4">
            <span
              aria-hidden="true"
              className="h-14 w-14 shrink-0 rounded-full bg-accent-soft text-ink grid place-items-center font-extrabold"
            >
              {initials(donor.name)}
            </span>
            <div className="min-w-0">
              <p className="text-[32px] leading-none font-extrabold tracking-tight tabular text-ink">
                {formatMoney(donor.given, currency)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {donor.gifts} {donor.gifts === 1 ? "aporte" : "aportes"} · {formatMoney(donor.givenAllTime, currency)} en total
              </p>
            </div>
          </div>

          {(donor.document || donor.phone || donor.email || donor.notes) && (
            <dl className="mt-4 divide-y divide-line border-t border-line">
              <Dato label="Documento" value={donor.document} />
              <Dato label="Teléfono" value={donor.phone} />
              <Dato label="Correo" value={donor.email} />
              <Dato label="Notas" value={donor.notes} />
            </dl>
          )}
        </Card>

        <div className="flex flex-wrap gap-2">
          {donor.gifts > 0 && (
            <Button
              variant="accent"
              onClick={() => statement.mutate({ id: donor._id, year })}
              disabled={statement.isPending}
            >
              <LuFileText aria-hidden="true" />
              {statement.isPending ? "Preparando…" : `Constancia ${year}`}
            </Button>
          )}
          {canWrite && (
            <Button
              variant="ghost"
              onClick={() => archive.mutate({ id: donor._id, archived: !donor.archived })}
              disabled={archive.isPending}
            >
              {donor.archived ? <LuArchiveRestore aria-hidden="true" /> : <LuArchive aria-hidden="true" />}
              {donor.archived ? "Volver a usarlo" : "Archivar"}
            </Button>
          )}
          {canWrite && donor.giftsAllTime === 0 && (
            <Button variant="danger-ghost" onClick={handleDelete} disabled={remove.isPending}>
              <LuTrash2 aria-hidden="true" /> Borrar
            </Button>
          )}
        </div>

        <section aria-labelledby="aportes">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 id="aportes" className="font-extrabold">
              Sus aportes
            </h2>
            {gifts.data?.total > 0 && (
              <Link
                to={`/movimientos?aportante=${donor._id}`}
                className="text-sm font-semibold text-muted hover:text-ink"
              >
                Ver en Movimientos
              </Link>
            )}
          </div>
          {gifts.isError && <AlertMessage type="error" message={getErrorMessage(gifts.error)} />}
          {gifts.data?.transactions?.length ? (
            <Card as="ul" className="divide-y divide-line overflow-hidden">
              {gifts.data.transactions.map((t) => (
                <TransactionRow
                  key={t._id}
                  transaction={t}
                  icon={iconOf(t.category)}
                  currency={currency}
                  href={`/update-transactions/${t._id}`}
                />
              ))}
            </Card>
          ) : (
            !gifts.isLoading && <p className="px-1 text-sm text-muted">Todavía no tiene aportes registrados.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default DonorDetail;
