import { useMemo, useState } from "react";
import { LuCalculator } from "react-icons/lu";
import { denominationsFor, sumBreakdown } from "../../lib/denominations";
import { formatMoney } from "../../lib/money";
import { Field, Input, Notice } from "../ui";

//! La hoja de conteo: una fila por billete y moneda, como en la mesa. Si de
//! esta moneda no sabemos las denominaciones, se pide solo el total.
const CountSheet = ({ currency, counts, onChange, total, onTotalChange }) => {
  const denominations = useMemo(() => denominationsFor(currency), [currency]);
  const [verTodas, setVerTodas] = useState(false);

  if (denominations.length === 0) {
    return (
      <Field label={`Total contado (${currency})`} htmlFor="conteo-total">
        <Input
          id="conteo-total"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={total}
          onChange={(e) => onTotalChange(e.target.value)}
          required
        />
      </Field>
    );
  }

  //! De entrada solo las denominaciones grandes: las monedas pequeñas llenan
  //! la pantalla y casi nunca se usan todas
  const visibles = verTodas ? denominations : denominations.slice(0, 7);
  const suma = sumBreakdown(
    denominations.map((value) => ({ value, count: counts[value] || 0 }))
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {visibles.map((value) => {
          const cantidad = counts[value] ?? "";
          const subtotal = Number(value) * (Number(cantidad) || 0);
          return (
            <label
              key={value}
              className="rounded-2xl bg-surface-2 px-3 py-2 flex items-center gap-2"
            >
              <span className="text-sm font-bold text-ink tabular w-16 shrink-0">
                {formatMoney(value, currency)}
              </span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={cantidad}
                onChange={(e) => onChange(value, e.target.value)}
                aria-label={`Cuántos de ${formatMoney(value, currency)}`}
                placeholder="0"
                className="h-9 w-full min-w-0 rounded-xl bg-surface px-2 text-sm font-semibold text-ink"
              />
              {subtotal > 0 && (
                <span className="text-xs text-muted tabular whitespace-nowrap">
                  {formatMoney(subtotal, currency)}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {denominations.length > 7 && (
        <button
          type="button"
          onClick={() => setVerTodas((v) => !v)}
          className="text-sm font-semibold text-muted hover:text-ink"
        >
          {verTodas ? "Ver solo los billetes" : "Ver también las monedas"}
        </button>
      )}

      <div className="flex items-center justify-between rounded-2xl bg-accent-soft px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <LuCalculator aria-hidden="true" /> Suma del conteo
        </span>
        <span className="text-xl font-extrabold tabular text-ink">
          {formatMoney(suma, currency)}
        </span>
      </div>

      {suma === 0 && (
        <Notice tone="info">Escribe cuántos billetes y monedas hay de cada uno.</Notice>
      )}
    </div>
  );
};

export default CountSheet;
