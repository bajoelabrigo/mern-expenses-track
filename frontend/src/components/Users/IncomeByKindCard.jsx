import { formatMoney, fromCents, toCents } from "../../lib/money";
import { INCOME_KINDS, inferIncomeKind } from "../../lib/incomeKinds";
import { Card } from "../ui";
import { CATEGORY_COLORS, cx } from "../ui/styles";

//! Un color fijo por tipo (el gris para "otro"): el diezmo siempre se ve igual
const KIND_COLORS = {
  diezmo: CATEGORY_COLORS[3],
  ofrenda: CATEGORY_COLORS[0],
  primicia: CATEGORY_COLORS[2],
  especial: CATEGORY_COLORS[5],
  otro: CATEGORY_COLORS[CATEGORY_COLORS.length - 1],
};

//! Ingresos del período por tipo (diezmos, ofrendas…), en centavos. El tipo sale
//! de la categoría; si la categoría ya no existe, de su nombre.
const incomeByKind = (transactions, categories) => {
  const kindOf = new Map(categories.map((c) => [c.name, c.incomeKind]));
  const totals = new Map();
  let total = 0;
  transactions
    .filter((t) => t.type === "income")
    .forEach((t) => {
      const kind = kindOf.get(t.category) || inferIncomeKind(t.category);
      const cents = toCents(t.amount);
      totals.set(kind, (totals.get(kind) || 0) + cents);
      total += cents;
    });
  const rows = INCOME_KINDS.filter((k) => totals.get(k.value)).map((k) => ({
    ...k,
    cents: totals.get(k.value),
    color: KIND_COLORS[k.value],
  }));
  return { rows, total };
};

//! Tarjeta del Inicio de una iglesia: de dónde vino lo que entró. `wide`: a
//! todo el ancho de la pantalla grande, los tipos van lado a lado.
const IncomeByKindCard = ({ transactions, categories, currency, periodLabel, wide, className = "" }) => {
  const { rows, total } = incomeByKind(transactions, categories);
  if (total === 0) return null;

  return (
    <Card as="section" aria-labelledby="ingresos-tipo" className={cx("p-5", className)}>
      <h2 id="ingresos-tipo" className="font-extrabold">
        Ingresos por tipo · {periodLabel}
      </h2>
      <div className="mt-4 flex h-3 rounded-full overflow-hidden gap-0.5" aria-hidden="true">
        {rows.map((r) => (
          <div key={r.value} style={{ width: `${(r.cents / total) * 100}%`, backgroundColor: r.color }} />
        ))}
      </div>
      {wide && (
        <ul className="mt-4 hidden xl:grid grid-cols-5 gap-3">
          {rows.map((r) => (
            <li key={r.value} className="rounded-2xl bg-surface-2 px-4 py-3">
              <p className="flex items-center gap-2 text-sm text-ink-2">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: r.color }} />
                {r.plural}
              </p>
              <p className="mt-1 font-extrabold tabular text-ink">{formatMoney(fromCents(r.cents), currency)}</p>
              <p className="text-xs font-semibold tabular text-muted">{Math.round((r.cents / total) * 100)}%</p>
            </li>
          ))}
        </ul>
      )}
      <ul className={cx("mt-4 space-y-2", wide && "xl:hidden")}>
        {rows.map((r) => (
          <li key={r.value} className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: r.color }} />
            <span className="flex-1 text-ink-2">{r.plural}</span>
            <span className="tabular font-semibold text-ink">{formatMoney(fromCents(r.cents), currency)}</span>
            <span className="tabular text-muted font-semibold w-10 text-right">
              {Math.round((r.cents / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default IncomeByKindCard;
