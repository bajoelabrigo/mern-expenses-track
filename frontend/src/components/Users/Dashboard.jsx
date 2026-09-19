import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";
import { LuTrendingDown, LuTrendingUp } from "react-icons/lu";
import {
  getTransactionByPeriodAPI,
  listTransationsAPI,
} from "../../services/transactions/transactionService";
import { listCategoriesAPI } from "../../services/category/categoryService";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useThemeColors } from "../../hooks/useThemeColors";
import { getErrorMessage } from "../../lib/axios";
import { formatMoney, fromCents, toCents } from "../../lib/money";
import { periodRange, toISODate } from "../../lib/periods";
import { Card, Eyebrow, Segmented, EmptyState, ButtonLink } from "../ui";
import { CATEGORY_COLORS } from "../ui/styles";
import AlertMessage from "../Alert/AlertMessage";
import WorkspacePicker from "../layout/WorkspacePicker";
import PendingTransactions from "../Transactions/PendingTransactions";
import TransactionRow from "../Transactions/TransactionRow";

ChartJS.register(ArcElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

const capitalize = (text = "") => text.charAt(0).toUpperCase() + text.slice(1);

const PERIODS = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
];

//! Sumas en centavos (sin error de coma flotante)
const totalsOf = (transactions) => {
  let income = 0;
  let expense = 0;
  transactions.forEach((t) => {
    if (t.type === "income") income += toCents(t.amount);
    else expense += toCents(t.amount);
  });
  return { income, expense, net: income - expense };
};

//! Saldo acumulado día a día dentro del período (hasta hoy)
const runningNet = (transactions, start, end) => {
  const byDay = new Map();
  transactions.forEach((t) => {
    const key = toISODate(new Date(t.date));
    const cents = toCents(t.amount) * (t.type === "income" ? 1 : -1);
    byDay.set(key, (byDay.get(key) || 0) + cents);
  });

  const today = toISODate(new Date());
  const last = end < today ? end : today;
  const points = [];
  let acc = 0;
  const [y, m, d] = start.split("-").map(Number);
  for (let day = new Date(y, m - 1, d); toISODate(day) <= last; day.setDate(day.getDate() + 1)) {
    const key = toISODate(day);
    acc += byDay.get(key) || 0;
    points.push({ key, value: fromCents(acc) });
  }
  return points;
};

//! Gastos por categoría: las 4 mayores y "Lo demás"
const spendingByCategory = (transactions) => {
  const map = new Map();
  transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => map.set(t.category, (map.get(t.category) || 0) + toCents(t.amount)));
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((acc, [, v]) => acc + v, 0);
  const total = sorted.reduce((acc, [, v]) => acc + v, 0);
  //! Colores por orden (no por nombre): en la dona nunca se repiten
  const rows = top.map(([name, cents], i) => ({ name, cents, color: CATEGORY_COLORS[i] }));
  if (rest > 0) rows.push({ name: "lo demás", cents: rest, color: CATEGORY_COLORS[CATEGORY_COLORS.length - 1] });
  return { rows, total };
};

const Dashboard = () => {
  const user = useSelector((state) => state.auth.user);
  const { workspace, currency } = useWorkspace();
  const colors = useThemeColors();
  const [period, setPeriod] = useState("month");
  const range = useMemo(() => periodRange(period), [period]);

  const current = useQuery({
    queryKey: ["transactions", "period", range.start, range.end],
    queryFn: () => getTransactionByPeriodAPI({ startDate: range.start, endDate: range.end }),
  });
  const previous = useQuery({
    queryKey: ["transactions", "period", range.prevStart, range.prevEnd],
    queryFn: () => getTransactionByPeriodAPI({ startDate: range.prevStart, endDate: range.prevEnd }),
  });
  const recent = useQuery({
    queryKey: ["list-transactions", "recent"],
    queryFn: () => listTransationsAPI({ page: 1, limit: 5 }),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["list-categories"],
    queryFn: listCategoriesAPI,
  });

  const transactions = useMemo(() => current.data || [], [current.data]);
  const totals = useMemo(() => totalsOf(transactions), [transactions]);
  const prevTotals = useMemo(() => totalsOf(previous.data || []), [previous.data]);
  const series = useMemo(() => runningNet(transactions, range.start, range.end), [transactions, range]);
  const spending = useMemo(() => spendingByCategory(transactions), [transactions]);
  const iconOf = (name) => categories.find((c) => c.name === name)?.icon;

  //! Variación del flujo neto frente al período anterior
  const delta = prevTotals.net !== 0 ? (totals.net - prevTotals.net) / Math.abs(prevTotals.net) : null;
  const maxInOut = Math.max(totals.income, totals.expense, 1);
  const initials = (user?.username || "?").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="lg:hidden min-w-0">
          <WorkspacePicker size="lg" />
        </div>
        <h1 className="hidden lg:block text-[26px] font-extrabold tracking-tight">Inicio</h1>
        <Link
          to="/profile"
          aria-label="Tu perfil"
          className="h-10 w-10 shrink-0 rounded-full bg-accent-soft text-ink font-bold text-sm flex items-center justify-center"
        >
          {initials}
        </Link>
      </header>

      <PendingTransactions />

      {current.isError && <AlertMessage type="error" message={getErrorMessage(current.error)} />}

      {/* Flujo neto: la cifra que importa */}
      <section aria-labelledby="flujo-neto">
        <Eyebrow>
          <span id="flujo-neto">Flujo neto · {range.label}</span>
        </Eyebrow>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[40px] leading-none font-extrabold tracking-tight tabular">
            {formatMoney(fromCents(totals.net), currency)}
          </p>
          {delta !== null && Number.isFinite(delta) && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                delta >= 0 ? "bg-income-soft text-income" : "bg-accent-soft text-ink"
              }`}
            >
              {delta >= 0 ? <LuTrendingUp aria-hidden="true" /> : <LuTrendingDown aria-hidden="true" />}
              {delta >= 0 ? "+" : "−"}
              {Math.abs(Math.round(delta * 100))}% vs {range.previousLabel}
            </span>
          )}
        </div>

        <div className="mt-4 h-44 -mx-1">
          {series.length > 1 ? (
            <Line
              aria-label={`Saldo acumulado de ${range.label}`}
              role="img"
              data={{
                labels: series.map((p) => p.key),
                datasets: [
                  {
                    data: series.map((p) => p.value),
                    stepped: true,
                    borderColor: colors.accent,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    //! Relleno hasta abajo del gráfico (no hasta el cero)
                    fill: "start",
                    backgroundColor: (ctx) => {
                      const { chart } = ctx;
                      const area = chart.chartArea;
                      if (!area) return "transparent";
                      const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
                      g.addColorStop(0, `${colors.accent}55`);
                      g.addColorStop(1, `${colors.accent}00`);
                      return g;
                    },
                  },
                ],
              }}
              options={{
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: "index", intersect: false },
                scales: { x: { display: false }, y: { display: false } },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    displayColors: false,
                    callbacks: {
                      title: (items) =>
                        new Date(`${items[0].label}T12:00:00`).toLocaleDateString("es", {
                          day: "numeric",
                          month: "short",
                        }),
                      label: (item) => formatMoney(item.parsed.y, currency),
                    },
                  },
                },
              }}
            />
          ) : (
            <div className="h-full grid place-items-center text-sm text-muted">
              {current.isLoading ? "Cargando…" : "Aún no hay movimientos en este período."}
            </div>
          )}
        </div>

        <Segmented
          className="mt-3"
          label="Período"
          options={PERIODS}
          value={period}
          onChange={setPeriod}
        />
      </section>

      {/* Entró / Salió */}
      <section className="grid grid-cols-2 gap-3">
        {[
          { label: "Entró", cents: totals.income, bar: "bg-income" },
          { label: "Salió", cents: totals.expense, bar: "bg-expense" },
        ].map(({ label, cents, bar }) => (
          <Card key={label} className="p-4">
            <Eyebrow>
              {label} · {range.label}
            </Eyebrow>
            <p className="mt-1.5 text-xl font-extrabold tabular">{formatMoney(fromCents(cents), currency)}</p>
            <div className="mt-3 h-1.5 rounded-full bg-surface-2 overflow-hidden" aria-hidden="true">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${(cents / maxInOut) * 100}%` }} />
            </div>
          </Card>
        ))}
      </section>

      {/* En qué se fue */}
      {spending.total > 0 && (
        <Card as="section" className="p-4 flex items-center gap-5" aria-label="Gastos por categoría">
          <div className="relative h-32 w-32 shrink-0">
            <Doughnut
              data={{
                labels: spending.rows.map((r) => r.name),
                datasets: [
                  {
                    data: spending.rows.map((r) => fromCents(r.cents)),
                    backgroundColor: spending.rows.map((r) => r.color),
                    borderColor: colors.surface,
                    borderWidth: 3,
                    borderRadius: 4,
                  },
                ],
              }}
              options={{
                cutout: "72%",
                animation: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Gastado</span>
              <span className="text-sm font-extrabold tabular">
                {formatMoney(fromCents(spending.total), currency)}
              </span>
            </div>
          </div>
          <ul className="flex-1 min-w-0 space-y-1.5">
            {spending.rows.map((r) => (
              <li key={r.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: r.color }} />
                <span className="flex-1 truncate text-ink-2">{capitalize(r.name)}</span>
                <span className="tabular text-muted font-semibold">
                  {Math.round((r.cents / spending.total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Últimos movimientos */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="font-extrabold">Últimos movimientos</h2>
          <Link to="/movimientos" className="text-sm font-semibold text-muted hover:text-ink">
            Ver todos
          </Link>
        </div>
        {recent.data?.transactions?.length ? (
          <Card as="ul" className="divide-y divide-line overflow-hidden">
            {recent.data.transactions.map((t) => (
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
          !recent.isLoading && (
            <EmptyState title={`${workspace?.name || "Este espacio"} aún no tiene movimientos`}>
              Registra el primero: una ofrenda, un diezmo o un gasto.
              {" "}
            </EmptyState>
          )
        )}
        {!recent.isLoading && !recent.data?.transactions?.length && (
          <div className="mt-3 flex justify-center">
            <ButtonLink to="/add-transaction" variant="accent">
              Registrar movimiento
            </ButtonLink>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
