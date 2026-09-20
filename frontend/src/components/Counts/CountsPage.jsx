import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuBan, LuCheck, LuPlus, LuSignature } from "react-icons/lu";
import {
  confirmCountAPI,
  createCountAPI,
  listCountsAPI,
  voidCountAPI,
} from "../../services/counts/countService";
import { useFunds } from "../../hooks/useFunds";
import { useWorkspace } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import { denominationsFor, sumBreakdown } from "../../lib/denominations";
import { formatMoney } from "../../lib/money";
import { shortDate, toISODate } from "../../lib/periods";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select } from "../ui";
import { cx } from "../ui/styles";
import CountSheet from "./CountSheet";

const COUNTS_KEY = ["conteos"];

const CULTOS = ["Culto del domingo", "Culto de oración", "Escuela dominical", "Culto de jóvenes"];

//! Un conteo de la lista, con su estado y lo que se puede hacer con él
const CountRow = ({ count, currency, me, canSign, onConfirm, onVoid, working }) => {
  const pendiente = count.status === "pendiente";
  const anulado = count.status === "anulado";
  //! El control entero: quien contó no puede firmar su propio conteo
  const esMio = String(count.countedBy?._id || count.countedBy) === String(me);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cx("font-extrabold truncate", anulado ? "line-through text-muted" : "text-ink")}>
            {count.service}
          </p>
          <p className="text-xs text-muted">
            {shortDate(count.date)} · contó {count.countedBy?.username}
            {count.fund && ` · ${count.fund.name}`}
          </p>
        </div>
        <span
          className={cx(
            "text-xl font-extrabold tabular whitespace-nowrap",
            anulado ? "line-through text-muted" : "text-ink"
          )}
        >
          {formatMoney(count.amount, currency)}
        </span>
      </div>

      {count.breakdown?.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          {count.breakdown
            .map((row) => `${row.count} × ${formatMoney(row.value, currency)}`)
            .join(" · ")}
        </p>
      )}

      {count.note && <p className="mt-2 text-sm text-ink-2">{count.note}</p>}

      <div className="mt-3 pt-3 border-t border-line">
        {anulado ? (
          <p className="text-sm text-muted">Descartado: {count.voidReason}</p>
        ) : pendiente ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2">
              <LuSignature aria-hidden="true" /> Falta la segunda firma
            </span>
            {canSign && !esMio && (
              <Button size="sm" variant="accent" onClick={() => onConfirm(count)} disabled={working}>
                <LuCheck aria-hidden="true" /> Firmar y asentar
              </Button>
            )}
            {canSign && esMio && (
              <span className="text-sm text-muted">Tiene que firmarla otra persona.</span>
            )}
            {canSign && (
              <Button size="sm" variant="ghost" onClick={() => onVoid(count)} disabled={working}>
                <LuBan aria-hidden="true" /> Descartar
              </Button>
            )}
          </div>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-income">
            <LuCheck aria-hidden="true" /> Firmado por {count.countedBy?.username} y{" "}
            {count.confirmedBy?.username}
          </p>
        )}
      </div>
    </Card>
  );
};

//! /conteos — contar la ofrenda entre dos
const CountsPage = () => {
  const queryClient = useQueryClient();
  const { currency, can, workspace } = useWorkspace();
  //! Contar la ofrenda entre dos es cosa de una iglesia, no de las cuentas
  //! de una persona
  const esIglesia = workspace?.kind === "iglesia";
  const { funds } = useFunds();
  const canSign = can("tx:write");

  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(() => ({
    date: toISODate(new Date()),
    service: CULTOS[0],
    fund: "general",
    note: "",
    total: "",
  }));
  const [counts, setCounts] = useState({});

  const query = useQuery({ queryKey: COUNTS_KEY, queryFn: listCountsAPI, enabled: esIglesia });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: COUNTS_KEY });
    //! Al asentar aparece un movimiento nuevo: el resto de pantallas también
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["list-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["funds"] });
  };

  const crear = useMutation({
    mutationFn: createCountAPI,
    onSuccess: () => {
      refrescar();
      setAbierto(false);
      setCounts({});
      setForm((f) => ({ ...f, note: "", total: "" }));
    },
  });
  const confirmar = useMutation({ mutationFn: confirmCountAPI, onSuccess: refrescar });
  const descartar = useMutation({ mutationFn: voidCountAPI, onSuccess: refrescar });

  if (workspace && !esIglesia) return <Navigate to="/dashboard" replace />;
  if (query.isLoading) return <AlertMessage type="loading" message="Cargando…" />;
  if (query.isError) return <AlertMessage type="error" message={getErrorMessage(query.error)} />;

  const { counts: lista = [], me } = query.data || {};
  const pendientes = lista.filter((c) => c.status === "pendiente");
  const denominations = denominationsFor(currency);

  const totalHoja =
    denominations.length > 0
      ? sumBreakdown(denominations.map((value) => ({ value, count: counts[value] || 0 })))
      : Number(form.total) || 0;

  const enviar = (e) => {
    e.preventDefault();
    const breakdown =
      denominations.length > 0
        ? denominations
            .map((value) => ({ value, count: Number(counts[value]) || 0 }))
            .filter((row) => row.count > 0)
        : undefined;

    crear.mutate({
      date: form.date,
      service: form.service.trim(),
      fund: form.fund,
      note: form.note.trim(),
      ...(breakdown ? { breakdown } : { amount: Number(form.total) }),
    });
  };

  const error = [crear, confirmar, descartar].find((m) => m.isError);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <PageHeader
        title="Conteo de ofrenda"
        subtitle="Se cuenta entre dos y firman los dos"
        action={
          canSign && (
            <Button variant="accent" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
              <LuPlus aria-hidden="true" /> Contar
            </Button>
          )
        }
      />

      {error && <Notice tone="danger">{getErrorMessage(error.error)}</Notice>}

      {pendientes.length > 0 && (
        <Notice tone="warning">
          {pendientes.length === 1
            ? "Hay 1 conteo esperando la segunda firma: no ha entrado al libro todavía."
            : `Hay ${pendientes.length} conteos esperando la segunda firma: no han entrado al libro todavía.`}
        </Notice>
      )}

      {abierto && canSign && (
        <Card as="form" onSubmit={enviar} className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Fecha" htmlFor="conteo-fecha">
              <Input
                id="conteo-fecha"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </Field>
            <Field label="Culto" htmlFor="conteo-culto">
              <Input
                id="conteo-culto"
                list="cultos-sugeridos"
                value={form.service}
                onChange={(e) => setForm({ ...form, service: e.target.value })}
                maxLength={80}
                required
              />
              <datalist id="cultos-sugeridos">
                {CULTOS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>

          <CountSheet
            currency={currency}
            counts={counts}
            onChange={(value, cantidad) => setCounts({ ...counts, [value]: cantidad })}
            total={form.total}
            onTotalChange={(total) => setForm({ ...form, total })}
          />

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Fondo" htmlFor="conteo-fondo">
              <Select
                id="conteo-fondo"
                value={form.fund}
                onChange={(e) => setForm({ ...form, fund: e.target.value })}
              >
                {funds
                  .filter((f) => !f.archived)
                  .map((f) => (
                    <option key={f._id || "general"} value={f._id || "general"}>
                      {f.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Nota (opcional)" htmlFor="conteo-nota">
              <Input
                id="conteo-nota"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                maxLength={300}
                placeholder="Algo que haya que recordar"
              />
            </Field>
          </div>

          <Notice tone="info">
            Al guardar queda a la espera de que <strong>otra persona</strong> lo firme. Hasta
            entonces no entra al libro.
          </Notice>

          <Button type="submit" variant="accent" disabled={crear.isPending || totalHoja <= 0}>
            {crear.isPending ? "Guardando…" : `Guardar el conteo de ${formatMoney(totalHoja, currency)}`}
          </Button>
        </Card>
      )}

      {lista.length === 0 ? (
        <EmptyState title="Todavía no hay conteos">
          Cuando cuenten la ofrenda de un culto, regístrenla aquí: la firma una persona y la
          confirma otra.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {lista.map((count) => (
            <CountRow
              key={count._id}
              count={count}
              currency={currency}
              me={me}
              canSign={canSign}
              working={confirmar.isPending || descartar.isPending}
              onConfirm={(c) => confirmar.mutate(c._id)}
              onVoid={(c) => {
                const reason = window.prompt("¿Por qué se descarta este conteo?");
                if (reason?.trim()) descartar.mutate({ id: c._id, reason: reason.trim() });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CountsPage;
