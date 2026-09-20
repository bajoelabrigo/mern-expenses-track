import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPublicReportAPI } from "../../services/workspaces/publicLinkService";
import { formatMoney } from "../../lib/money";
import { capitalize } from "../ui/styles";
import { Card } from "../ui";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const MONTHS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const KIND_LABELS = {
  diezmo: "Diezmos",
  ofrenda: "Ofrendas",
  primicia: "Primicias",
  especial: "Ofrendas especiales",
  otro: "Otros aportes",
};

const labelOf = (item) =>
  item.kind ? KIND_LABELS[item.kind] || KIND_LABELS.otro : capitalize(item.category);

//! Una cifra grande con su rótulo
const Figure = ({ label, value, currency, big }) => (
  <div>
    <p className="text-sm font-semibold text-muted">{label}</p>
    <p
      className={`mt-0.5 font-extrabold tabular tracking-tight text-ink ${
        big ? "text-[34px] leading-none" : "text-xl"
      }`}
    >
      {formatMoney(value, currency)}
    </p>
  </div>
);

//! Una lista de conceptos con su monto
const Breakdown = ({ title, items, currency, total }) => {
  if (!items || items.length === 0) return null;
  return (
    <Card className="p-5">
      <h2 className="font-extrabold text-ink">{title}</h2>
      <ul className="mt-3 divide-y divide-line">
        {items.map((item) => (
          <li key={item.kind || item.category} className="flex justify-between gap-4 py-2.5">
            <span className="text-ink-2 truncate">{labelOf(item)}</span>
            <span className="font-bold tabular text-ink whitespace-nowrap">
              {formatMoney(item.amount, currency)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 pt-3 border-t border-line flex justify-between gap-4">
        <span className="font-extrabold text-ink">Total</span>
        <span className="font-extrabold tabular text-ink">{formatMoney(total, currency)}</span>
      </div>
    </Card>
  );
};

//! /cuentas/:token — el resumen que la iglesia comparte con su congregación.
//! Sin sesión, y solo con totales: aquí no hay nombres de quién dio ni el
//! detalle de cada movimiento.
const PublicReport = () => {
  const { token } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["publico", token],
    queryFn: () => getPublicReportAPI(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-muted">Cargando…</div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-[28px] font-extrabold tracking-tight text-ink">
          Este enlace ya no funciona
        </h1>
        <p className="mt-3 text-ink-2 leading-relaxed">
          Puede que la iglesia lo haya cambiado o dejado de compartir. Pídele el enlace nuevo a la
          tesorería.
        </p>
      </div>
    );
  }

  const { currency } = data;
  const periodo =
    data.period === "mes" ? `${MONTHS[data.month - 1]} de ${data.year}` : `el año ${data.year}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-4">
      <header className="text-center">
        {data.logo && (
          <img
            src={data.logo}
            alt=""
            className="mx-auto mb-4 h-16 w-auto max-w-[160px] object-contain"
          />
        )}
        <h1 className="text-[30px] leading-tight font-extrabold tracking-tight text-ink">
          {data.church}
        </h1>
        <p className="mt-1 text-muted">Cuentas de {periodo}</p>
      </header>

      <Card className="p-6 space-y-5">
        <Figure label="Quedó en caja" value={data.closing} currency={currency} big />
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-line">
          <Figure label="Entró" value={data.income} currency={currency} />
          <Figure label="Salió" value={data.expense} currency={currency} />
        </div>
        <p className="text-sm text-muted">
          Se empezó {data.period === "mes" ? "el mes" : "el año"} con{" "}
          {formatMoney(data.opening, currency)}.
        </p>
      </Card>

      <Breakdown
        title="De dónde entró"
        items={data.incomeBreakdown}
        currency={currency}
        total={data.income}
      />
      <Breakdown
        title="En qué se fue"
        items={data.expenseBreakdown}
        currency={currency}
        total={data.expense}
      />

      {data.months && (
        <Card className="p-5">
          <h2 className="font-extrabold text-ink">Mes a mes</h2>
          <ul className="mt-3 divide-y divide-line">
            {data.months.map((m) => (
              <li key={m.month} className="grid grid-cols-3 gap-2 py-2 text-sm">
                <span className="text-ink-2">{MONTHS_SHORT[m.month - 1]}</span>
                <span className="text-right tabular text-income">
                  {formatMoney(m.income, currency)}
                </span>
                <span className="text-right tabular text-muted">
                  {formatMoney(m.expense, currency)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.funds && data.funds.length > 1 && (
        <Card className="p-5">
          <h2 className="font-extrabold text-ink">Cómo está repartido</h2>
          <ul className="mt-3 divide-y divide-line">
            {data.funds.map((f) => (
              <li key={f.name} className="flex justify-between gap-4 py-2.5">
                <span className="text-ink-2 truncate">{f.name}</span>
                <span className="font-bold tabular text-ink whitespace-nowrap">
                  {formatMoney(f.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <footer className="pt-4 text-center text-sm text-muted">
        <p>
          Este resumen lo publica la tesorería de {data.church}. Para el detalle, pídeselo a ellos.
        </p>
      </footer>
    </div>
  );
};

export default PublicReport;
