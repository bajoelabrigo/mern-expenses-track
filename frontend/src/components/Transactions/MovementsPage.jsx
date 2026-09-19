import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { LuCalendarRange, LuDownload, LuSearch, LuX } from "react-icons/lu";
import {
  exportTransactionExcelAPI,
  listTransationsAPI,
} from "../../services/transactions/transactionService";
import { listCategoriesAPI } from "../../services/category/categoryService";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { getErrorMessage } from "../../lib/axios";
import { formatMoney, fromCents } from "../../lib/money";
import { dayLabel } from "../../lib/periods";
import { Button, Card, Chip, EmptyState, Input, PageHeader } from "../ui";
import AlertMessage from "../Alert/AlertMessage";
import TransactionRow from "./TransactionRow";
import PendingTransactions from "./PendingTransactions";
import TransactionsTable from "./TransactionsTable";
import { groupByDay } from "./groupByDay";

const PAGE_SIZE = 30;

const FILTERS = [
  { value: "all", label: "Todos" },
  { value: "income", label: "Ingresos" },
  { value: "expense", label: "Gastos" },
  { value: "recurrent", label: "Recurrentes" },
  { value: "voided", label: "Anulados" },
];

//! Retrasa un valor (la búsqueda no consulta en cada tecla)
const useDebounced = (value, ms = 350) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
};

const MovementsPage = () => {
  const { currency, can } = useWorkspace();
  //! En pantallas grandes, tabla; en el móvil, lista por días
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showDates, setShowDates] = useState(false);
  const [dates, setDates] = useState({ startDate: "", endDate: "" });
  const q = useDebounced(search.trim());

  const params = {
    q,
    type: filter === "income" || filter === "expense" ? filter : undefined,
    recurrent: filter === "recurrent",
    includeVoided: filter === "voided",
    ...dates,
  };

  const { data: categories = [] } = useQuery({ queryKey: ["list-categories"], queryFn: listCategoriesAPI });
  const iconOf = (name) => categories.find((c) => c.name === name)?.icon;

  const query = useInfiniteQuery({
    queryKey: ["list-transactions", "movements", params],
    queryFn: ({ pageParam }) => listTransationsAPI({ ...params, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.currentPage < last.totalPages ? last.currentPage + 1 : undefined),
  });

  const all = useMemo(() => {
    const list = query.data?.pages.flatMap((p) => p.transactions) || [];
    //! "Anulados" muestra solo los anulados (la API los incluye junto al resto)
    return filter === "voided" ? list.filter((t) => t.voided) : list;
  }, [query.data, filter]);
  const groups = useMemo(() => groupByDay(all), [all]);
  const total = query.data?.pages[0]?.total ?? 0;

  const exportMutation = useMutation({
    mutationFn: () =>
      exportTransactionExcelAPI({
        ...dates,
        type: params.type,
        includeVoided: filter === "voided",
      }),
  });

  return (
    <div className="max-w-3xl mx-auto lg:max-w-none">
      <PageHeader
        title="Movimientos"
        subtitle={query.isLoading ? "Cargando…" : `${total} ${total === 1 ? "movimiento" : "movimientos"}`}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            aria-label="Exportar a Excel"
          >
            <LuDownload aria-hidden="true" />
            <span className="hidden sm:inline">{exportMutation.isPending ? "Exportando…" : "Excel"}</span>
          </Button>
        }
      />

      <PendingTransactions />

      <div className="lg:flex lg:items-center lg:gap-4">
        <div className="relative lg:w-80 lg:shrink-0">
          <LuSearch aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por concepto o categoría"
            aria-label="Buscar movimientos"
            className="pl-11 rounded-full border-transparent shadow-card"
          />
        </div>

        <div className="mt-3 lg:mt-0 -mx-4 px-4 lg:mx-0 lg:px-0 flex gap-2 overflow-x-auto pb-1 lg:pb-0 [scrollbar-width:none]">
          {FILTERS.map((f) => (
            <Chip key={f.value} selected={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </Chip>
          ))}
          <Chip
            selected={showDates || Boolean(dates.startDate || dates.endDate)}
            onClick={() => setShowDates((v) => !v)}
            aria-expanded={showDates}
          >
            <span className="inline-flex items-center gap-1.5">
              <LuCalendarRange aria-hidden="true" /> Fechas
            </span>
          </Chip>
        </div>
      </div>

      {showDates && (
        <Card className="mt-3 p-3 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-36 text-xs font-semibold text-muted">
            Desde
            <Input
              type="date"
              value={dates.startDate}
              onChange={(e) => setDates((d) => ({ ...d, startDate: e.target.value }))}
              className="mt-1 h-10"
            />
          </label>
          <label className="flex-1 min-w-36 text-xs font-semibold text-muted">
            Hasta
            <Input
              type="date"
              value={dates.endDate}
              onChange={(e) => setDates((d) => ({ ...d, endDate: e.target.value }))}
              className="mt-1 h-10"
            />
          </label>
          {(dates.startDate || dates.endDate) && (
            <Button variant="ghost" size="sm" onClick={() => setDates({ startDate: "", endDate: "" })}>
              <LuX aria-hidden="true" /> Quitar
            </Button>
          )}
        </Card>
      )}

      <div className="mt-4 space-y-2">
        {(query.isError || exportMutation.isError) && (
          <AlertMessage type="error" message={getErrorMessage(query.error || exportMutation.error)} />
        )}

        {!query.isLoading && groups.length === 0 && !query.isError && (
          <EmptyState title={q ? `Nada coincide con «${q}»` : "No hay movimientos con estos filtros"}>
            {q ? "Prueba con otra palabra o quita los filtros." : "Cambia el filtro o las fechas."}
          </EmptyState>
        )}

        {isDesktop && all.length > 0 && (
          <div className="pt-2">
            <TransactionsTable
              transactions={all}
              grouped
              iconOf={iconOf}
              currency={currency}
              hrefOf={can("tx:read") ? (t) => `/update-transactions/${t._id}` : undefined}
              caption="Movimientos"
            />
          </div>
        )}

        {!isDesktop && groups.map((group) => (
          <section key={group.key} aria-label={dayLabel(group.date)}>
            <div className="flex items-baseline justify-between px-1 pt-3 pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                {dayLabel(group.date)}
              </h2>
              <span className={`text-xs font-bold tabular ${group.net >= 0 ? "text-income" : "text-muted"}`}>
                {group.net >= 0 ? "+" : "−"}
                {formatMoney(Math.abs(fromCents(group.net)), currency)}
              </span>
            </div>
            <Card as="ul" className="divide-y divide-line overflow-hidden">
              {group.items.map((t) => (
                <TransactionRow
                  key={t._id}
                  transaction={t}
                  icon={iconOf(t.category)}
                  currency={currency}
                  href={can("tx:read") ? `/update-transactions/${t._id}` : undefined}
                />
              ))}
            </Card>
          </section>
        ))}

        {query.hasNextPage && (
          <div className="pt-3 flex justify-center">
            <Button
              variant="secondary"
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
            >
              {query.isFetchingNextPage ? "Cargando…" : "Ver más"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovementsPage;
