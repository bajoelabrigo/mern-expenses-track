import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { LuChevronLeft, LuChevronRight, LuTrendingDown, LuTrendingUp } from "react-icons/lu";
import {
  getBalanceAPI,
  getTransactionByPeriodAPI,
  getYearByMonthAPI,
  listTransationsAPI,
} from "../../services/transactions/transactionService";
import { listCategoriesAPI } from "../../services/category/categoryService";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { getErrorMessage } from "../../lib/axios";
import { formatMoney, fromCents, toCents } from "../../lib/money";
import { periodRange, toISODate } from "../../lib/periods";
import { Card, Eyebrow, Segmented, EmptyState, ButtonLink } from "../ui";
import { CATEGORY_COLORS, capitalize, cx, initials } from "../ui/styles";
import AlertMessage from "../Alert/AlertMessage";
import WorkspacePicker from "../layout/WorkspacePicker";
import PendingTransactions from "../Transactions/PendingTransactions";
import TransactionRow from "../Transactions/TransactionRow";
import TransactionsTable from "../Transactions/TransactionsTable";
import FundsSummaryCard from "../Funds/FundsSummaryCard";
import IncomeByKindCard from "./IncomeByKindCard";
import { useFunds } from "../../hooks/useFunds";

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip);

const PERIODS = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
];

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

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

//! Variación frente al período anterior (null si no hay con qué comparar)
const change = (now, before) => (before !== 0 ? (now - before) / Math.abs(before) : null);

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

const percent = (v) => `${Math.round(v * 100)}%`;

//! "+12% vs agosto". `higherIsBetter`: en los gastos, subir no es buena noticia.
//! `format` muestra la magnitud (por defecto en porcentaje); `plain`: sin verde
//! ni ámbar, para ir sobre la tarjeta ámbar.
const DeltaChip = ({ value, previousLabel, higherIsBetter = true, format = percent, plain, className = "" }) => {
  if (value === null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const good = up === higherIsBetter;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
        plain ? "bg-accent-ink/10" : good ? "bg-income-soft text-income" : "bg-accent-soft text-ink",
        className
      )}
    >
      {up ? <LuTrendingUp aria-hidden="true" /> : <LuTrendingDown aria-hidden="true" />}
      {up ? "+" : "−"}
      {format(Math.abs(value))} vs {previousLabel}
    </span>
  );
};

//! Línea escalonada del saldo acumulado (el Inicio del móvil)
const NetLineChart = ({ series, range, colors, currency, loading }) =>
  series.length > 1 ? (
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
      {loading ? "Cargando…" : "Aún no hay movimientos en este período."}
    </div>
  );

//! Dona de gastos por categoría. `stacked`: dona arriba y leyenda debajo
const SpendingDonut = ({ spending, colors, currency, stacked, title }) => (
  <Card
    as="section"
    aria-label="Gastos por categoría"
    className={stacked ? "p-5 flex flex-col gap-5" : "p-4"}
  >
    {title && <h2 className="font-extrabold">{title}</h2>}
    {spending.total > 0 ? (
      //! Apilada solo en pantallas muy anchas; si no, dona y leyenda lado a lado
      <div className={cx("flex items-center gap-5", stacked && "xl:flex-col xl:items-stretch")}>
        <div className={cx("relative shrink-0", stacked ? "h-44 w-44 xl:mx-auto" : "h-32 w-32")}>
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
            <span className={cx("font-extrabold tabular", stacked ? "text-base" : "text-sm")}>
              {formatMoney(fromCents(spending.total), currency)}
            </span>
          </div>
        </div>
        <ul className="flex-1 min-w-0 space-y-1.5">
          {spending.rows.map((r) => (
            <li key={r.name} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: r.color }} />
              <span className="flex-1 truncate text-ink-2">{capitalize(r.name)}</span>
              {stacked && (
                <span className="tabular text-ink-2 font-semibold">
                  {formatMoney(fromCents(r.cents), currency)}
                </span>
              )}
              <span className="tabular text-muted font-semibold w-10 text-right">
                {Math.round((r.cents / spending.total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : (
      <p className="text-sm text-muted">Sin gastos en este período.</p>
    )}
  </Card>
);

//! Barras de ingresos y gastos de cada mes del año; el mes en curso resaltado
const MonthlyBars = ({ currency, colors, className = "" }) => {
  const thisYear = new Date().getFullYear();
  const thisMonth = new Date().getMonth();
  const [year, setYear] = useState(thisYear);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["transactions", "by-month", year],
    queryFn: () => getYearByMonthAPI(year),
  });
  const months = data?.months || [];
  //! Los meses que no son el actual van atenuados (solo en el año en curso)
  const tint = (color, i) => (year === thisYear && i !== thisMonth ? `${color}80` : color);
  const compact = new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 });
  const hasData = months.some((m) => m.income || m.expense);

  return (
    <Card as="section" aria-labelledby="por-mes" className={cx("p-5 flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="por-mes" className="font-extrabold">
          Entró y salió por mes
        </h2>
        <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            aria-label="Año anterior"
            className="h-7 w-7 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface"
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
            className="h-7 w-7 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface disabled:opacity-30 disabled:pointer-events-none"
          >
            <LuChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex gap-4 text-xs font-semibold text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-income" /> Entró
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-expense" /> Salió
        </span>
      </div>

      {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
      <div className="mt-3 flex-1 min-h-64">
        {hasData ? (
          <Bar
            role="img"
            aria-label={`Ingresos y gastos por mes de ${year}`}
            data={{
              labels: MONTHS,
              datasets: [
                {
                  label: "Entró",
                  data: months.map((m) => m.income),
                  backgroundColor: months.map((_, i) => tint(colors.income, i)),
                  borderRadius: 6,
                  maxBarThickness: 18,
                },
                {
                  label: "Salió",
                  data: months.map((m) => m.expense),
                  backgroundColor: months.map((_, i) => tint(colors.expense, i)),
                  borderRadius: 6,
                  maxBarThickness: 18,
                },
              ],
            }}
            options={{
              maintainAspectRatio: false,
              animation: false,
              interaction: { mode: "index", intersect: false },
              scales: {
                x: {
                  grid: { display: false },
                  border: { display: false },
                  ticks: { color: colors.muted, font: { family: "Manrope", weight: 600 } },
                },
                y: {
                  grid: { color: colors.line },
                  border: { display: false },
                  ticks: {
                    color: colors.muted,
                    font: { family: "Manrope" },
                    maxTicksLimit: 5,
                    callback: (v) => compact.format(v),
                  },
                },
              },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    title: (items) => `${items[0].label} ${year}`,
                    label: (item) => ` ${item.dataset.label}: ${formatMoney(item.parsed.y, currency)}`,
                  },
                },
              },
            }}
          />
        ) : (
          <div className="h-full grid place-items-center text-sm text-muted">
            {isLoading ? "Cargando…" : `Sin movimientos en ${year}.`}
          </div>
        )}
      </div>
    </Card>
  );
};

//! Tarjeta de una cifra (fila superior del Inicio en pantallas grandes)
const StatCard = ({ label, value, footer, featured }) => (
  <div
    className={cx(
      "rounded-card p-5 flex flex-col justify-between gap-4 min-h-36",
      featured ? "bg-accent text-accent-ink" : "bg-surface shadow-card"
    )}
  >
    <p className={cx("text-sm font-semibold", featured ? "text-accent-ink/75" : "text-muted")}>{label}</p>
    <div>
      <p className="text-[28px] leading-none font-extrabold tracking-tight tabular">{value}</p>
      {footer && <div className="mt-2.5 min-h-5">{footer}</div>}
    </div>
  </div>
);

const Dashboard = () => {
  const user = useSelector((state) => state.auth.user);
  const { workspace, currency, can } = useWorkspace();
  const colors = useThemeColors();
  const isDesktop = useIsDesktop();
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
  const recentLimit = isDesktop ? 8 : 5;
  const recent = useQuery({
    queryKey: ["list-transactions", "recent", recentLimit],
    queryFn: () => listTransationsAPI({ page: 1, limit: recentLimit }),
  });
  //! Saldo en caja: todo lo registrado hasta hoy (solo en pantallas grandes)
  const balance = useQuery({
    queryKey: ["transactions", "balance"],
    queryFn: () => getBalanceAPI(),
    enabled: isDesktop,
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
  const isChurch = workspace?.kind === "iglesia";
  const { hasFunds } = useFunds();
  const incomeByKind = isChurch && totals.income > 0 && (
    <IncomeByKindCard
      transactions={transactions}
      categories={categories}
      currency={currency}
      periodLabel={range.label}
      wide={!hasFunds}
      className={hasFunds ? "" : "xl:col-span-3"}
    />
  );
  const money = (cents) => formatMoney(fromCents(cents), currency);

  //! El flujo neto se compara en dinero, no en porcentaje: si el mes anterior
  //! cerró cerca de cero o con el signo contrario, el porcentaje no dice nada
  //! ("−1317%"). Sin movimientos en el período anterior no hay comparación.
  const hadPrevious = prevTotals.income !== 0 || prevTotals.expense !== 0;
  const netDiff = hadPrevious ? totals.net - prevTotals.net : null;
  const maxInOut = Math.max(totals.income, totals.expense, 1);
  const recentItems = recent.data?.transactions || [];

  const periodPicker = (className) => (
    <Segmented className={className} label="Período" options={PERIODS} value={period} onChange={setPeriod} />
  );

  const emptyRecent = !recent.isLoading && recentItems.length === 0 && (
    <>
      <EmptyState title={`${workspace?.name || "Este espacio"} aún no tiene movimientos`}>
        Registra el primero: una ofrenda, un diezmo o un gasto.
      </EmptyState>
      {can("tx:write") && (
        <div className="mt-3 flex justify-center">
          <ButtonLink to="/add-transaction" variant="accent">
            Registrar movimiento
          </ButtonLink>
        </div>
      )}
    </>
  );

  const recentHeader = (
    <div className="flex items-center justify-between mb-2 px-1">
      <h2 className="font-extrabold">Últimos movimientos</h2>
      <Link to="/movimientos" className="text-sm font-semibold text-muted hover:text-ink">
        Ver todos
      </Link>
    </div>
  );

  const avatar = (
    <Link
      to="/profile"
      aria-label="Tu perfil"
      className="h-10 w-10 shrink-0 rounded-full bg-accent-soft text-ink font-bold text-sm flex items-center justify-center"
    >
      {initials(user?.username)}
    </Link>
  );

  if (isDesktop) {
    return (
      <div className="space-y-5">
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Inicio</h1>
            <p className="text-sm text-muted truncate">{workspace?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            {periodPicker("w-72")}
            {avatar}
          </div>
        </header>

        <PendingTransactions />
        {current.isError && <AlertMessage type="error" message={getErrorMessage(current.error)} />}

        <section aria-label={`Resumen de ${range.label}`} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            featured
            label={`Flujo neto · ${range.label}`}
            value={money(totals.net)}
            footer={<DeltaChip plain value={netDiff} format={money} previousLabel={range.previousLabel} />}
          />
          <StatCard
            label={`Entró · ${range.label}`}
            value={money(totals.income)}
            footer={<DeltaChip value={change(totals.income, prevTotals.income)} previousLabel={range.previousLabel} />}
          />
          <StatCard
            label={`Salió · ${range.label}`}
            value={money(totals.expense)}
            footer={
              <DeltaChip
                value={change(totals.expense, prevTotals.expense)}
                previousLabel={range.previousLabel}
                higherIsBetter={false}
              />
            }
          />
          <StatCard
            label="Saldo en caja"
            value={balance.data ? formatMoney(balance.data.balance, currency) : "…"}
            footer={<span className="text-xs font-semibold text-muted">Todo lo registrado hasta hoy</span>}
          />
        </section>

        <div className="grid xl:grid-cols-3 gap-4">
          <MonthlyBars className="xl:col-span-2" currency={currency} colors={colors} />
          <SpendingDonut
            stacked
            title={`En qué se fue · ${range.label}`}
            spending={spending}
            colors={colors}
            currency={currency}
          />
        </div>

        {(incomeByKind || hasFunds) && (
          <div className="grid xl:grid-cols-3 gap-4 items-start">
            {incomeByKind}
            <FundsSummaryCard currency={currency} className={isChurch ? "xl:col-span-2" : "xl:col-span-3"} />
          </div>
        )}

        <section>
          {recentHeader}
          {recentItems.length > 0 ? (
            <TransactionsTable
              transactions={recentItems}
              iconOf={iconOf}
              currency={currency}
              hrefOf={(t) => `/update-transactions/${t._id}`}
              caption="Últimos movimientos"
            />
          ) : (
            emptyRecent
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <WorkspacePicker size="lg" />
        </div>
        {avatar}
      </header>

      <PendingTransactions />

      {current.isError && <AlertMessage type="error" message={getErrorMessage(current.error)} />}

      {/* Flujo neto: la cifra que importa */}
      <section aria-labelledby="flujo-neto">
        <Eyebrow>
          <span id="flujo-neto">Flujo neto · {range.label}</span>
        </Eyebrow>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[40px] leading-none font-extrabold tracking-tight tabular">{money(totals.net)}</p>
          <DeltaChip value={netDiff} format={money} previousLabel={range.previousLabel} />
        </div>

        <div className="mt-4 h-44 -mx-1">
          <NetLineChart
            series={series}
            range={range}
            colors={colors}
            currency={currency}
            loading={current.isLoading}
          />
        </div>

        {periodPicker("mt-3")}
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
            <p className="mt-1.5 text-xl font-extrabold tabular">{money(cents)}</p>
            <div className="mt-3 h-1.5 rounded-full bg-surface-2 overflow-hidden" aria-hidden="true">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${(cents / maxInOut) * 100}%` }} />
            </div>
          </Card>
        ))}
      </section>

      {incomeByKind}

      {/* En qué se fue */}
      {spending.total > 0 && <SpendingDonut spending={spending} colors={colors} currency={currency} />}

      <FundsSummaryCard currency={currency} />

      {/* Últimos movimientos */}
      <section>
        {recentHeader}
        {recentItems.length > 0 ? (
          <Card as="ul" className="divide-y divide-line overflow-hidden">
            {recentItems.map((t) => (
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
          emptyRecent
        )}
      </section>
    </div>
  );
};

export default Dashboard;
