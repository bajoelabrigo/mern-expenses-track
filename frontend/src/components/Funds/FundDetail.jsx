import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LuArchive,
  LuArchiveRestore,
  LuArrowDownLeft,
  LuArrowLeftRight,
  LuArrowUpRight,
  LuBan,
  LuChevronLeft,
  LuPencil,
  LuPlus,
  LuTrash2,
} from "react-icons/lu";
import {
  deleteFundAPI,
  listTransfersAPI,
  updateFundAPI,
  voidTransferAPI,
} from "../../services/funds/fundService";
import { listTransationsAPI } from "../../services/transactions/transactionService";
import { listCategoriesAPI } from "../../services/category/categoryService";
import { FUNDS_KEY, TRANSFERS_KEY, fundKey, useFunds } from "../../hooks/useFunds";
import { useWorkspace } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import { formatMoney } from "../../lib/money";
import { shortDate } from "../../lib/periods";
import AlertMessage from "../Alert/AlertMessage";
import { Button, ButtonLink, Card, EmptyState, ListGroup, Notice } from "../ui";
import { cx } from "../ui/styles";
import TransactionRow from "../Transactions/TransactionRow";
import { FundIcon, GoalBar } from "./FundBits";

//! Un pase visto desde este fondo: recibido (+) o enviado (−)
const TransferRow = ({ transfer, thisKey, currency, onVoid }) => {
  const fromKey = transfer.from?._id || "general";
  const incoming = fromKey !== thisKey;
  const other = incoming ? transfer.from : transfer.to;
  const otherName = other?.name || "General";
  const Icon = incoming ? LuArrowDownLeft : LuArrowUpRight;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className={cx(
          "h-10 w-10 shrink-0 rounded-xl grid place-items-center",
          incoming ? "bg-income-soft text-income" : "bg-surface-2 text-ink-2"
        )}
      >
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx("font-semibold truncate", transfer.voided ? "line-through text-muted" : "text-ink")}>
          {incoming ? `Recibido de ${otherName}` : `Pasado a ${otherName}`}
        </p>
        <p className="text-xs text-muted truncate">
          {transfer.voided
            ? `Anulado: ${transfer.voidReason}`
            : [shortDate(transfer.date), transfer.note, transfer.createdBy?.username && `por ${transfer.createdBy.username}`]
                .filter(Boolean)
                .join(" · ")}
        </p>
      </div>
      <span
        className={cx(
          "tabular font-bold whitespace-nowrap",
          transfer.voided ? "line-through opacity-50" : incoming ? "text-income" : "text-ink"
        )}
      >
        {incoming ? "+" : "−"}
        {formatMoney(transfer.amount, currency)}
      </span>
      {onVoid && !transfer.voided && (
        <button
          type="button"
          onClick={() => onVoid(transfer)}
          aria-label="Anular este pase"
          className="h-9 px-2.5 sm:px-3.5 rounded-full inline-flex items-center gap-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 transition"
        >
          <LuBan aria-hidden="true" />
          <span className="hidden sm:inline">Anular</span>
        </button>
      )}
    </div>
  );
};

const Stat = ({ label, value, currency }) => (
  <div className="rounded-2xl bg-surface-2 px-4 py-3">
    <p className="text-xs font-semibold text-muted">{label}</p>
    <p className="mt-0.5 font-extrabold tabular text-ink">{formatMoney(value, currency)}</p>
  </div>
);

//! /fondos/:id (o /fondos/general)
const FundDetail = () => {
  const { id } = useParams();
  const key = id || "general";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currency, can } = useWorkspace();
  const { findFund, isLoading, isError, error } = useFunds();
  const fund = findFund(key);
  const canManage = can("fund:manage");

  const transfers = useQuery({
    queryKey: [...TRANSFERS_KEY, key],
    queryFn: () => listTransfersAPI({ fund: key, limit: 30 }),
  });
  const movements = useQuery({
    queryKey: ["list-transactions", "fund", key],
    queryFn: () => listTransationsAPI({ fund: key, page: 1, limit: 10 }),
  });
  const { data: categories = [] } = useQuery({ queryKey: ["list-categories"], queryFn: listCategoriesAPI });
  const iconOf = (name) => categories.find((c) => c.name === name)?.icon;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: FUNDS_KEY });
    queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY });
  };
  const archive = useMutation({ mutationFn: updateFundAPI, onSuccess: refresh });
  const remove = useMutation({
    mutationFn: deleteFundAPI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FUNDS_KEY });
      navigate("/fondos", { replace: true });
    },
  });
  const voidTransfer = useMutation({ mutationFn: voidTransferAPI, onSuccess: refresh });

  if (isLoading) return <AlertMessage type="loading" message="Cargando…" />;
  if (isError) return <AlertMessage type="error" message={getErrorMessage(error)} />;
  if (!fund) {
    return (
      <EmptyState title="Ese fondo no existe" action={<ButtonLink to="/fondos">Ver los fondos</ButtonLink>}>
        Puede que lo hayan borrado o que el enlace sea de otro espacio.
      </EmptyState>
    );
  }

  const neverUsed =
    !fund.general && fund.income === 0 && fund.expense === 0 && fund.transfersIn === 0 && fund.transfersOut === 0;
  const mutationError = [archive, remove, voidTransfer].find((m) => m.isError);

  const handleVoid = (transfer) => {
    const reason = window.prompt("¿Por qué se anula este pase? (queda en el historial)");
    if (reason && reason.trim()) voidTransfer.mutate({ id: transfer._id, reason: reason.trim() });
  };
  const handleDelete = () => {
    if (window.confirm(`¿Borrar el fondo "${fund.name}"? Nunca se usó, así que no se pierde nada.`)) {
      remove.mutate(fund._id);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/fondos" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <LuChevronLeft aria-hidden="true" /> Fondos
      </Link>

      <header className="flex items-start gap-4">
        <FundIcon fund={fund} size="lg" className={fund.archived ? "opacity-60" : ""} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-ink">{fund.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {fund.general ? "Todo lo que no está en otro fondo." : fund.description || "Sin descripción."}
          </p>
        </div>
        {canManage && !fund.general && (
          <ButtonLink to={`/fondos/${fund._id}/editar`} variant="secondary" size="sm" aria-label="Editar fondo">
            <LuPencil aria-hidden="true" />
            <span className="hidden sm:inline">Editar</span>
          </ButtonLink>
        )}
      </header>

      {fund.archived && (
        <Notice tone="warning">
          Fondo archivado: no se ofrece al registrar movimientos, pero su historia y su saldo siguen aquí.
        </Notice>
      )}
      {mutationError && <AlertMessage type="error" message={getErrorMessage(mutationError.error)} />}

      <Card className="p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-muted">Saldo</p>
          <p
            className={cx(
              "text-[40px] leading-none font-extrabold tracking-tight tabular",
              fund.balance < 0 ? "text-danger" : "text-ink"
            )}
          >
            {formatMoney(fund.balance, currency)}
          </p>
        </div>
        <GoalBar fund={fund} currency={currency} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Entró" value={fund.income} currency={currency} />
          <Stat label="Salió" value={fund.expense} currency={currency} />
          <Stat label="Recibido de otros" value={fund.transfersIn} currency={currency} />
          <Stat label="Pasado a otros" value={fund.transfersOut} currency={currency} />
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {can("tx:write") && !fund.archived && (
          <ButtonLink to="/add-transaction" state={{ fund: key }} variant="accent">
            <LuPlus aria-hidden="true" /> Registrar en este fondo
          </ButtonLink>
        )}
        {canManage && (
          <ButtonLink to={`/fondos/mover?desde=${key}`} variant="secondary">
            <LuArrowLeftRight aria-hidden="true" /> Mover dinero
          </ButtonLink>
        )}
        {canManage && !fund.general && (
          <Button
            variant="ghost"
            onClick={() => archive.mutate({ id: fund._id, archived: !fund.archived })}
            disabled={archive.isPending}
          >
            {fund.archived ? <LuArchiveRestore aria-hidden="true" /> : <LuArchive aria-hidden="true" />}
            {fund.archived ? "Volver a usarlo" : "Archivar"}
          </Button>
        )}
        {canManage && neverUsed && (
          <Button variant="danger-ghost" onClick={handleDelete} disabled={remove.isPending}>
            <LuTrash2 aria-hidden="true" /> Borrar
          </Button>
        )}
      </div>

      <section aria-labelledby="movimientos-fondo">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 id="movimientos-fondo" className="font-extrabold">
            Movimientos
          </h2>
          {movements.data?.total > 0 && (
            <Link to={`/movimientos?fondo=${key}`} className="text-sm font-semibold text-muted hover:text-ink">
              {movements.data.total === 1 ? "Ver en Movimientos" : `Ver los ${movements.data.total}`}
            </Link>
          )}
        </div>
        {movements.isError && <AlertMessage type="error" message={getErrorMessage(movements.error)} />}
        {movements.data?.transactions?.length ? (
          <Card as="ul" className="divide-y divide-line overflow-hidden">
            {movements.data.transactions.map((t) => (
              <TransactionRow
                key={t._id}
                transaction={{ ...t, fund: null }}
                icon={iconOf(t.category)}
                currency={currency}
                href={`/update-transactions/${t._id}`}
              />
            ))}
          </Card>
        ) : (
          !movements.isLoading && <p className="px-1 text-sm text-muted">Todavía no hay movimientos en este fondo.</p>
        )}
      </section>

      <section aria-labelledby="pases-fondo">
        <h2 id="pases-fondo" className="font-extrabold mb-2 px-1">
          Pases entre fondos
        </h2>
        {transfers.isError && <AlertMessage type="error" message={getErrorMessage(transfers.error)} />}
        {transfers.data?.length ? (
          <ListGroup>
            {transfers.data.map((t) => (
              <TransferRow
                key={t._id}
                transfer={t}
                thisKey={fundKey(fund)}
                currency={currency}
                onVoid={canManage ? handleVoid : undefined}
              />
            ))}
          </ListGroup>
        ) : (
          !transfers.isLoading && (
            <p className="px-1 text-sm text-muted">Aún no se ha pasado dinero desde o hacia este fondo.</p>
          )
        )}
      </section>
    </div>
  );
};

export default FundDetail;
