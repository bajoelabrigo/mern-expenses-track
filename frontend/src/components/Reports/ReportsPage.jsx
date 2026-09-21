import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LuChevronLeft, LuChevronRight, LuDownload, LuFileText, LuUserCheck } from "react-icons/lu";
import {
  downloadAnnualReportAPI,
  downloadMonthlyReportAPI,
} from "../../services/reports/reportService";
import { getPaymentsReportAPI } from "../../services/donors/donorService";
import { useWorkspace } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import { formatMoney } from "../../lib/money";
import { Button, Card, Notice, PageHeader, Segmented } from "../ui";
import { cx } from "../ui/styles";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

//! El año y el mes en curso: nada de lo que viene después tiene movimientos
const NOW = new Date();
const THIS_YEAR = NOW.getFullYear();
const THIS_MONTH = NOW.getMonth() + 1;

//! Flechas para elegir el año
const YearPicker = ({ year, onChange, max = THIS_YEAR }) => (
  <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1 w-fit">
    <button
      type="button"
      onClick={() => onChange(year - 1)}
      aria-label="Año anterior"
      className="h-9 w-9 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface"
    >
      <LuChevronLeft aria-hidden="true" />
    </button>
    <span className="px-2 font-bold tabular" aria-live="polite">
      {year}
    </span>
    <button
      type="button"
      onClick={() => onChange(year + 1)}
      disabled={year >= max}
      aria-label="Año siguiente"
      className="h-9 w-9 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface disabled:opacity-30 disabled:pointer-events-none"
    >
      <LuChevronRight aria-hidden="true" />
    </button>
  </div>
);

//! /informes — descargar el informe de un mes o de un año
const ReportsPage = () => {
  const { workspace, currency, can } = useWorkspace();
  const [kind, setKind] = useState("mensual");
  const [year, setYear] = useState(THIS_YEAR);
  const [month, setMonth] = useState(THIS_MONTH);

  //! Pagos a personas del año: cuánto se llevó la tesorería en remuneraciones.
  //! Solo para quien ve personas y solo en una iglesia (es donde las hay).
  const verPagos = can("donor:read") && workspace?.kind === "iglesia";
  const pagosQuery = useQuery({
    queryKey: ["pagos-report", workspace?._id, year],
    queryFn: () => getPaymentsReportAPI({ year }),
    enabled: verPagos,
  });

  //! Un mes que todavía no ha llegado no se puede pedir
  const isFuture = (m) => year === THIS_YEAR && m > THIS_MONTH;

  const download = useMutation({
    mutationFn: () =>
      kind === "mensual"
        ? downloadMonthlyReportAPI({ year, month })
        : downloadAnnualReportAPI({ year }),
  });

  //! Al cambiar de año, un mes futuro deja de valer
  const changeYear = (next) => {
    setYear(next);
    if (next === THIS_YEAR && month > THIS_MONTH) setMonth(THIS_MONTH);
    download.reset();
  };

  const periodo = kind === "mensual" ? `${MONTHS[month - 1]} de ${year}` : `el año ${year}`;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <PageHeader
        title="Informes"
        subtitle="Para leer en la iglesia y archivar firmados"
      />

      <Segmented
        label="Tipo de informe"
        value={kind}
        onChange={(value) => {
          setKind(value);
          download.reset();
        }}
        options={[
          { value: "mensual", label: "De un mes" },
          { value: "anual", label: "De un año" },
        ]}
      />

      <Card className="p-5 space-y-5">
        <div>
          <p className="text-sm font-semibold text-muted mb-2">Año</p>
          <YearPicker year={year} onChange={changeYear} />
        </div>

        {kind === "mensual" && (
          <div>
            <p className="text-sm font-semibold text-muted mb-2">Mes</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {MONTHS.map((name, i) => {
                const value = i + 1;
                const selected = value === month;
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={selected}
                    disabled={isFuture(value)}
                    onClick={() => {
                      setMonth(value);
                      download.reset();
                    }}
                    className={cx(
                      "h-10 rounded-xl text-sm font-semibold transition",
                      selected ? "bg-ink text-surface" : "bg-surface-2 text-ink-2 hover:text-ink",
                      "disabled:opacity-30 disabled:pointer-events-none"
                    )}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-1 border-t border-line">
          <p className="mt-4 text-sm text-ink-2 leading-relaxed">
            El informe de <strong className="text-ink">{periodo}</strong> lleva el saldo con el que
            se abrió, lo que entró y en qué se fue, el saldo con el que cierra y las firmas de
            tesorería.
          </p>

          <Button
            variant="accent"
            className="mt-4"
            onClick={() => download.mutate()}
            disabled={download.isPending}
          >
            <LuDownload aria-hidden="true" />
            {download.isPending ? "Preparando…" : "Descargar en PDF"}
          </Button>
        </div>

        {download.isError && <Notice tone="danger">{getErrorMessage(download.error)}</Notice>}
        {download.isSuccess && <Notice tone="success">Se descargó {download.data}</Notice>}
      </Card>

      {verPagos && (
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="h-10 w-10 rounded-xl bg-surface-2 text-ink grid place-items-center">
                <LuUserCheck aria-hidden="true" />
              </span>
              <h2 className="mt-3 font-extrabold text-ink">Pagos a personas en {year}</h2>
            </div>
            <YearPicker year={year} onChange={setYear} />
          </div>

          {pagosQuery.isError && (
            <p className="mt-2 text-sm text-muted">{getErrorMessage(pagosQuery.error)}</p>
          )}

          {pagosQuery.data && (
            <>
              <p className="mt-3 text-[28px] leading-none font-extrabold tracking-tight tabular text-ink">
                {formatMoney(pagosQuery.data.total, currency)}
              </p>
              <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">
                En {pagosQuery.data.payments}{" "}
                {pagosQuery.data.payments === 1 ? "pago" : "pagos"} a{" "}
                {pagosQuery.data.people.length}{" "}
                {pagosQuery.data.people.length === 1 ? "persona" : "personas"}
                {pagosQuery.data.expenseTotal > 0 && (
                  <>
                    : el <strong className="text-ink">{pagosQuery.data.share}%</strong> de todo el
                    gasto del año.
                  </>
                )}
                .
              </p>

              {pagosQuery.data.byKind.length > 0 && (
                <ul className="mt-4 divide-y divide-line border-t border-line">
                  {pagosQuery.data.byKind.map((k) => (
                    <li key={k.kind} className="flex justify-between gap-3 py-2">
                      <span className="text-sm text-muted">{k.label}</span>
                      <span className="text-sm font-semibold tabular text-ink">
                        {formatMoney(k.amount, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {pagosQuery.data.people.length > 0 && (
                <ul className="mt-4 divide-y divide-line border-t border-line">
                  {pagosQuery.data.people.map((p) => (
                    <li key={p._id} className="flex justify-between gap-3 py-2">
                      <span className="text-sm font-semibold text-ink truncate">
                        {p.name}
                        {p.member && (
                          <span className="ml-2 text-xs font-normal text-muted">miembro</span>
                        )}
                      </span>
                      <span className="text-sm font-semibold tabular text-ink whitespace-nowrap">
                        {formatMoney(p.amount, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {pagosQuery.data.total === 0 && (
                <p className="mt-2 text-sm text-muted">
                  Todavía no hay gastos con &quot;se le pagó a&quot; en {year}.
                </p>
              )}
            </>
          )}
        </Card>
      )}

      <Card className="p-5">
        <span className="h-10 w-10 rounded-xl bg-surface-2 text-ink grid place-items-center">
          <LuFileText aria-hidden="true" />
        </span>
        <h2 className="mt-3 font-extrabold text-ink">¿Necesitas el detalle de una actividad?</h2>
        <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">
          Estos informes resumen {workspace?.kind === "iglesia" ? "toda la iglesia" : "todo"}. Para
          rendir cuentas de un almuerzo o una campaña en concreto, entra a su fondo y usa
          &quot;Informe en PDF&quot;: ahí sale cada aporte y cada compra.
        </p>
      </Card>
    </div>
  );
};

export default ReportsPage;
