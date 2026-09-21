import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { LuChevronLeft, LuChevronRight, LuFileText, LuLock, LuPlus, LuSearch } from "react-icons/lu";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useDonors } from "../../hooks/useDonors";
import { getErrorMessage } from "../../lib/axios";
import { formatMoney } from "../../lib/money";
import AlertMessage from "../Alert/AlertMessage";
import { Button, ButtonLink, Card, EmptyState, Input, ListGroup, PageHeader } from "../ui";
import { downloadPaymentStatementsAPI, downloadStatementsAPI } from "../../services/donors/donorService";
import { cx, initials } from "../ui/styles";

//! /aportantes — "Personas": quién dio y a quién se le pagó, y cuánto, en el
//! año. Solo para la tesorería.
const DonorsPage = () => {
  const { workspace, currency, can } = useWorkspace();
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const { donors, canSee, isLoading, isError, error } = useDonors({ year });
  const canWrite = can("donor:write");
  const thisYear = new Date().getFullYear();
  const statements = useMutation({ mutationFn: downloadStatementsAPI });
  const paymentStatements = useMutation({ mutationFn: downloadPaymentStatementsAPI });

  if (workspace && !canSee) return <Navigate to="/dashboard" replace />;

  const text = search.trim().toLowerCase();
  const shown = text
    ? donors.filter((d) => `${d.name} ${d.document}`.toLowerCase().includes(text))
    : donors;
  const active = shown.filter((d) => !d.archived);
  const archived = shown.filter((d) => d.archived);
  const enCentavos = (n) => Math.round((n || 0) * 100);
  const totalGiven = donors.reduce((acc, d) => acc + enCentavos(d.given), 0) / 100;
  const totalPaid = donors.reduce((acc, d) => acc + enCentavos(d.paid), 0) / 100;

  const row = (donor) => (
    <Link
      key={donor._id}
      to={`/aportantes/${donor._id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition"
    >
      <span
        aria-hidden="true"
        className={cx(
          "h-10 w-10 shrink-0 rounded-full grid place-items-center text-xs font-bold",
          donor.archived ? "bg-surface-2 text-muted" : "bg-accent-soft text-ink"
        )}
      >
        {initials(donor.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink truncate">
          {donor.name}
          {donor.member && <span className="ml-2 text-xs font-normal text-muted">miembro</span>}
        </span>
        <span className="block text-xs text-muted truncate">
          {donor.gifts > 0 ? `${donor.gifts} ${donor.gifts === 1 ? "aporte" : "aportes"}` : "Sin aportes"}
          {donor.payments > 0 &&
            ` · ${donor.payments} ${donor.payments === 1 ? "pago" : "pagos"}`}
          {` en ${year}`}
          {donor.archived && " · Archivado"}
        </span>
      </span>
      <span className="text-right whitespace-nowrap">
        <span className="block tabular font-bold text-ink">
          {formatMoney(donor.given, currency)}
        </span>
        {donor.paid > 0 && (
          <span className="block text-xs tabular text-muted">
            −{formatMoney(donor.paid, currency)}
          </span>
        )}
      </span>
      <LuChevronRight aria-hidden="true" className="text-muted shrink-0" />
    </Link>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Personas"
        subtitle={`Quién dio y a quién se le pagó en ${year}. Lo ven el propietario, el tesorero y el contador.`}
        action={
          canWrite && (
            <ButtonLink to="/aportantes/nuevo" size="sm">
              <LuPlus aria-hidden="true" /> Nueva
            </ButtonLink>
          )
        }
      />

      <div className="space-y-4">
        {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
        {statements.isError && (
          <AlertMessage type="error" message={getErrorMessage(statements.error)} />
        )}
        {paymentStatements.isError && (
          <AlertMessage type="error" message={getErrorMessage(paymentStatements.error)} />
        )}

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted">Recibido de personas en {year}</p>
              <p className="text-[26px] leading-tight font-extrabold tracking-tight tabular text-ink">
                {formatMoney(totalGiven, currency)}
              </p>
            </div>
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

          <div className="border-t border-line pt-3">
            <p className="text-xs font-semibold text-muted">Pagado a personas en {year}</p>
            <p className="text-[22px] leading-tight font-extrabold tracking-tight tabular text-ink">
              {formatMoney(totalPaid, currency)}
            </p>
          </div>
        </Card>

        {totalGiven > 0 && (
          <Button
            variant="secondary"
            block
            onClick={() => statements.mutate({ year })}
            disabled={statements.isPending}
          >
            <LuFileText aria-hidden="true" />
            {statements.isPending ? "Preparando…" : `Constancias de aportes ${year} (PDF)`}
          </Button>
        )}

        {totalPaid > 0 && (
          <Button
            variant="secondary"
            block
            onClick={() => paymentStatements.mutate({ year })}
            disabled={paymentStatements.isPending}
          >
            <LuFileText aria-hidden="true" />
            {paymentStatements.isPending
              ? "Preparando…"
              : `Constancias de pagos ${year} (PDF)`}
          </Button>
        )}

        {donors.length > 6 && (
          <div className="relative">
            <LuSearch aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o documento"
              aria-label="Buscar personas"
              className="pl-11 rounded-full border-transparent shadow-card"
            />
          </div>
        )}

        {isLoading && <AlertMessage type="loading" message="Cargando…" />}

        {!isLoading && donors.length === 0 && (
          <EmptyState
            title="Todavía no hay personas"
            action={canWrite && <ButtonLink to="/aportantes/nuevo">Agregar la primera</ButtonLink>}
          >
            Anota a quienes dan diezmos u ofrendas para darles su constancia a fin de año, y a
            quienes la iglesia les paga por un trabajo (así sale su constancia de pagos).
          </EmptyState>
        )}

        {active.length > 0 && <ListGroup>{active.map(row)}</ListGroup>}

        {archived.length > 0 && (
          <section aria-labelledby="archivados">
            <h2 id="archivados" className="text-sm font-bold text-muted px-1 mb-2">
              Archivados · {archived.length}
            </h2>
            <ListGroup>{archived.map(row)}</ListGroup>
          </section>
        )}

        {!isLoading && shown.length === 0 && donors.length > 0 && (
          <p className="px-1 text-sm text-muted">Nadie coincide con «{search.trim()}».</p>
        )}

        <p className="flex items-start gap-2 px-1 text-xs text-muted">
          <LuLock aria-hidden="true" className="mt-0.5 shrink-0" />
          Los datos de las personas, lo que dieron y lo que se les pagó no se muestran al auditor
          ni a los lectores del espacio.
        </p>
      </div>
    </div>
  );
};

export default DonorsPage;
