import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LuArrowDown } from "react-icons/lu";
import { createTransferAPI } from "../../services/funds/fundService";
import { FUNDS_KEY, TRANSFERS_KEY, fundKey, useFunds } from "../../hooks/useFunds";
import { useWorkspace } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import { formatMoney, parseTypedAmount } from "../../lib/money";
import { toISODate } from "../../lib/periods";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Card, Field, Input, Notice, PageHeader, Select } from "../ui";

const toApi = (key) => (key === "general" ? null : key);

//! /fondos/mover?desde=…&hacia=… — pasar dinero de un fondo a otro. No es un
//! ingreso ni un gasto: el total en caja no cambia.
const TransferPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const { workspace, currency, can } = useWorkspace();
  const { funds, isLoading, hasFunds, findFund } = useFunds();

  //! De un archivado se puede sacar lo que le queda; a uno archivado no entra
  const fromOptions = funds;
  const toOptions = funds.filter((f) => !f.archived);

  const [from, setFrom] = useState(params.get("desde") || "general");
  const [to, setTo] = useState(params.get("hacia") || "");
  const [amountText, setAmountText] = useState("");
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const mutation = useMutation({
    mutationFn: createTransferAPI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FUNDS_KEY });
      queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY });
      navigate(`/fondos/${from}`, { replace: true });
    },
  });

  if (!workspace || isLoading) return <AlertMessage type="loading" message="Cargando…" />;
  if (!can("fund:manage") || !hasFunds) return <Navigate to="/fondos" replace />;

  //! Destino por defecto: el primero distinto del origen
  const toKey = to || fundKey(toOptions.find((f) => fundKey(f) !== from));
  const source = findFund(from);
  const amount = parseTypedAmount(amountText);
  const sameFund = from === toKey;
  const amountError = touched && amount === null ? "Escribe cuánto dinero pasa, por ejemplo 500" : "";
  const leavesNegative = source && amount !== null && amount > source.balance;

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (amount === null || sameFund) return;
    mutation.mutate({ from: toApi(from), to: toApi(toKey), amount, date, note: note.trim() });
  };

  const option = (f) => (
    <option key={fundKey(f)} value={fundKey(f)}>
      {f.icon} {f.name} · {formatMoney(f.balance, currency)}
      {f.archived ? " (archivado)" : ""}
    </option>
  );

  return (
    <div className="max-w-md mx-auto">
      <PageHeader
        title="Mover dinero"
        subtitle="De un fondo a otro. El total en caja no cambia, solo cómo está repartido."
      />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {mutation.isError && <AlertMessage type="error" message={getErrorMessage(mutation.error)} />}

        <Card className="p-5 space-y-3">
          <Field label="Sale de" htmlFor="transfer-from">
            <Select id="transfer-from" value={from} onChange={(e) => setFrom(e.target.value)}>
              {fromOptions.map(option)}
            </Select>
          </Field>
          <div className="flex justify-center text-muted" aria-hidden="true">
            <LuArrowDown className="text-xl" />
          </div>
          <Field
            label="Entra a"
            htmlFor="transfer-to"
            error={touched && sameFund ? "Elige un fondo distinto del de origen" : ""}
          >
            <Select id="transfer-to" value={toKey} onChange={(e) => setTo(e.target.value)}>
              {toOptions.map(option)}
            </Select>
          </Field>
        </Card>

        <Card className="p-5 space-y-5">
          <Field label="Monto" htmlFor="transfer-amount" error={amountError}>
            <Input
              id="transfer-amount"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0.00"
              className="text-xl font-bold tabular"
            />
          </Field>
          {leavesNegative && (
            <Notice tone="warning">
              {source.name} tiene {formatMoney(source.balance, currency)}: con este pase quedará en negativo.
            </Notice>
          )}
          <Field label="Fecha" htmlFor="transfer-date">
            <Input
              id="transfer-date"
              type="date"
              value={date}
              max="9999-12-31"
              onChange={(e) => setDate(e.target.value || toISODate(new Date()))}
            />
          </Field>
          <Field label="Motivo" htmlFor="transfer-note" hint="Opcional. Por ejemplo: acuerdo de la junta del 12 de marzo.">
            <Input id="transfer-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </Card>

        <Button type="submit" size="lg" block disabled={mutation.isPending}>
          {mutation.isPending
            ? "Moviendo…"
            : amount
              ? `Mover ${formatMoney(amount, currency)}`
              : "Mover dinero"}
        </Button>
      </form>
    </div>
  );
};

export default TransferPage;
