import { Link } from "react-router-dom";
import { LuArrowLeftRight, LuPlus } from "react-icons/lu";
import { useWorkspace } from "../../hooks/useWorkspace";
import { fundKey, useFunds } from "../../hooks/useFunds";
import { getErrorMessage } from "../../lib/axios";
import { formatMoney } from "../../lib/money";
import AlertMessage from "../Alert/AlertMessage";
import { ButtonLink, Card, ListGroup, PageHeader } from "../ui";
import { FundCard, FundIcon } from "./FundBits";

//! /fondos — cómo está repartido el dinero del espacio
const FundsPage = () => {
  const { workspace, currency, can } = useWorkspace();
  const { funds, isLoading, isError, error, hasFunds } = useFunds();
  const canManage = can("fund:manage");

  const active = funds.filter((f) => !f.archived);
  const archived = funds.filter((f) => f.archived);
  //! La suma de los saldos es lo que hay en caja (los pases no cambian el total)
  const total = funds.reduce((acc, f) => acc + Math.round(f.balance * 100), 0) / 100;

  return (
    <div className="max-w-3xl mx-auto lg:max-w-none">
      <PageHeader
        title="Fondos"
        subtitle={
          hasFunds
            ? `${formatMoney(total, currency)} en caja, repartidos así.`
            : `Aparta dinero de ${workspace?.name || "este espacio"} para un fin.`
        }
        action={
          canManage && (
            <div className="flex gap-2">
              {hasFunds && (
                <ButtonLink to="/fondos/mover" variant="secondary" size="sm">
                  <LuArrowLeftRight aria-hidden="true" />
                  <span className="hidden sm:inline">Mover dinero</span>
                </ButtonLink>
              )}
              <ButtonLink to="/fondos/nuevo" size="sm">
                <LuPlus aria-hidden="true" /> Nuevo
              </ButtonLink>
            </div>
          )
        }
      />

      <div className="space-y-6">
        {isLoading && <AlertMessage type="loading" message="Cargando…" />}
        {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}

        {!isLoading && !hasFunds && (
          <Card className="p-6">
            <p className="font-bold text-ink">Separa el dinero que tiene un destino</p>
            <p className="mt-1.5 text-sm text-ink-2 leading-relaxed max-w-prose">
              Por ejemplo: <strong>Misiones</strong>, <strong>Construcción del templo</strong> o{" "}
              <strong>Ayuda social</strong>. Cada ofrenda o gasto se anota en su fondo y siempre sabrás
              cuánto queda en cada uno. Si le pones una meta, verás cuánto falta. Lo que no tenga fondo
              queda en <strong>General</strong>.
            </p>
            {canManage && (
              <div className="mt-4">
                <ButtonLink to="/fondos/nuevo">
                  <LuPlus aria-hidden="true" /> Crear el primer fondo
                </ButtonLink>
              </div>
            )}
          </Card>
        )}

        {active.length > 0 && (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {active.map((fund) => (
              <FundCard key={fundKey(fund)} fund={fund} currency={currency} />
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <section aria-labelledby="archivados">
            <h2 id="archivados" className="text-sm font-bold text-muted px-1 mb-2">
              Archivados · {archived.length}
            </h2>
            <ListGroup>
              {archived.map((fund) => (
                <Link
                  key={fund._id}
                  to={`/fondos/${fund._id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition"
                >
                  <FundIcon fund={fund} size="sm" className="opacity-60" />
                  <span className="flex-1 min-w-0 truncate font-semibold text-ink-2">{fund.name}</span>
                  <span className="tabular text-sm font-semibold text-muted">
                    {formatMoney(fund.balance, currency)}
                  </span>
                </Link>
              ))}
            </ListGroup>
          </section>
        )}
      </div>
    </div>
  );
};

export default FundsPage;
