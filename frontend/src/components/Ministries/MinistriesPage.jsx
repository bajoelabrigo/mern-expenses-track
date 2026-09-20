import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LuArchive,
  LuArchiveRestore,
  LuChevronLeft,
  LuChevronRight,
  LuPencil,
  LuPlus,
  LuTrash2,
} from "react-icons/lu";
import {
  createMinistryAPI,
  deleteMinistryAPI,
  listMinistriesAPI,
  listMinistryExpensesAPI,
  updateMinistryAPI,
} from "../../services/ministries/ministryService";
import { listMembersAPI } from "../../services/workspaces/workspaceService";
import { useWorkspace } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import { formatMoney } from "../../lib/money";
import { shortDate } from "../../lib/periods";
import { capitalize } from "../ui/styles";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select } from "../ui";
import MinistryBar from "./MinistryBar";

const MINISTRIES_KEY = ["ministerios"];
const THIS_YEAR = new Date().getFullYear();

//! Los gastos de un ministerio, que se abren al pedirlos
const Expenses = ({ ministry, currency }) => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...MINISTRIES_KEY, ministry._id, "gastos"],
    queryFn: () => listMinistryExpensesAPI(ministry._id),
  });

  if (isLoading) return <p className="mt-3 text-sm text-muted">Cargando…</p>;
  if (isError) return <Notice tone="danger">{getErrorMessage(error)}</Notice>;
  if (data.length === 0) {
    return <p className="mt-3 text-sm text-muted">Todavía no se le cargó ningún gasto.</p>;
  }

  return (
    <ul className="mt-3 divide-y divide-line">
      {data.map((gasto) => (
        <li key={gasto._id} className="flex items-baseline justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="text-sm text-ink truncate">
              {gasto.description || capitalize(gasto.category)}
            </p>
            <p className="text-xs text-muted">
              {shortDate(gasto.date)} · {capitalize(gasto.category)}
              {gasto.hasReceipt && " · con recibo"}
            </p>
          </div>
          <span className="text-sm font-bold tabular text-ink whitespace-nowrap">
            {formatMoney(gasto.amount, currency)}
          </span>
        </li>
      ))}
    </ul>
  );
};

//! Formulario para crear o editar un ministerio
const MinistryForm = ({ year, ministry, members, onDone, onCancel }) => {
  const [form, setForm] = useState(() => ({
    name: ministry?.name || "",
    budget: ministry?.budget ?? "",
    icon: ministry?.icon || "🙌",
    leader: ministry?.leader?._id || "",
  }));

  const guardar = useMutation({
    mutationFn: () =>
      ministry
        ? updateMinistryAPI({
            id: ministry._id,
            name: form.name.trim(),
            budget: Number(form.budget),
            icon: form.icon,
            leader: form.leader || null,
          })
        : createMinistryAPI({
            year,
            name: form.name.trim(),
            budget: Number(form.budget),
            icon: form.icon,
            leader: form.leader || null,
          }),
    onSuccess: onDone,
  });

  return (
    <Card
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        guardar.mutate();
      }}
      className="p-5 space-y-4"
    >
      <div className="grid sm:grid-cols-[5rem_1fr] gap-3">
        <Field label="Ícono" htmlFor="min-icono">
          <Input
            id="min-icono"
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            maxLength={8}
            className="text-center text-xl"
          />
        </Field>
        <Field label="Nombre" htmlFor="min-nombre">
          <Input
            id="min-nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Jóvenes, Damas, Misiones…"
            maxLength={60}
            required
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={`Presupuesto de ${year}`} htmlFor="min-presupuesto">
          <Input
            id="min-presupuesto"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
            required
          />
        </Field>
        <Field
          label="Quién lo lleva"
          htmlFor="min-lider"
          hint="Verá su presupuesto, y nada más de las cuentas"
        >
          <Select
            id="min-lider"
            value={form.leader}
            onChange={(e) => setForm({ ...form, leader: e.target.value })}
          >
            <option value="">Nadie por ahora</option>
            {members.map((m) => (
              <option key={m.user?._id || m._id} value={m.user?._id || m._id}>
                {m.user?.username || m.username}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {guardar.isError && <Notice tone="danger">{getErrorMessage(guardar.error)}</Notice>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="accent" disabled={guardar.isPending}>
          {guardar.isPending ? "Guardando…" : ministry ? "Guardar" : "Crear el ministerio"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
};

//! /ministerios — presupuesto anual de cada ministerio
const MinistriesPage = () => {
  const queryClient = useQueryClient();
  const { can, workspace } = useWorkspace();
  const puedeGestionar = can("ministry:manage");
  //! Un líder solo recibe el suyo: la pantalla es la misma, más corta
  const soloElMio = can("ministry:own") && !can("ministry:read");

  const [year, setYear] = useState(THIS_YEAR);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [abierto, setAbierto] = useState(null);

  const query = useQuery({
    queryKey: [...MINISTRIES_KEY, year],
    queryFn: () => listMinistriesAPI(year),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members", workspace?._id],
    queryFn: () => listMembersAPI(workspace._id),
    enabled: Boolean(puedeGestionar && workspace?._id),
  });

  const refrescar = () => queryClient.invalidateQueries({ queryKey: MINISTRIES_KEY });

  const archivar = useMutation({ mutationFn: updateMinistryAPI, onSuccess: refrescar });
  const borrar = useMutation({ mutationFn: deleteMinistryAPI, onSuccess: refrescar });

  if (query.isLoading) return <AlertMessage type="loading" message="Cargando…" />;
  if (query.isError) return <AlertMessage type="error" message={getErrorMessage(query.error)} />;

  const { ministries = [], currency } = query.data;
  const pasados = ministries.filter((m) => m.exceeded);
  const cerca = ministries.filter((m) => m.warning);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <PageHeader
        title={soloElMio ? "Mi ministerio" : "Ministerios"}
        subtitle={soloElMio ? "Tu presupuesto y en qué se ha ido" : "Presupuesto anual de cada uno"}
        action={
          puedeGestionar && (
            <Button
              variant="accent"
              onClick={() => {
                setCreando((v) => !v);
                setEditando(null);
              }}
            >
              <LuPlus aria-hidden="true" /> Nuevo
            </Button>
          )
        }
      />

      <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1 w-fit">
        <button
          type="button"
          onClick={() => setYear((y) => y - 1)}
          aria-label="Año anterior"
          className="h-9 w-9 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface"
        >
          <LuChevronLeft aria-hidden="true" />
        </button>
        <span className="px-2 font-bold tabular" aria-live="polite">
          {year}
        </span>
        <button
          type="button"
          onClick={() => setYear((y) => y + 1)}
          aria-label="Año siguiente"
          className="h-9 w-9 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface"
        >
          <LuChevronRight aria-hidden="true" />
        </button>
      </div>

      {pasados.length > 0 && (
        <Notice tone="danger">
          {pasados.length === 1
            ? `${pasados[0].name} se pasó de su presupuesto.`
            : `${pasados.length} ministerios se pasaron de su presupuesto.`}
        </Notice>
      )}
      {cerca.length > 0 && (
        <Notice tone="warning">
          {cerca.length === 1
            ? `A ${cerca[0].name} le queda poco presupuesto.`
            : `A ${cerca.length} ministerios les queda poco presupuesto.`}
        </Notice>
      )}

      {(creando || editando) && puedeGestionar && (
        <MinistryForm
          year={year}
          ministry={editando}
          members={members}
          onDone={() => {
            refrescar();
            setCreando(false);
            setEditando(null);
          }}
          onCancel={() => {
            setCreando(false);
            setEditando(null);
          }}
        />
      )}

      {(archivar.isError || borrar.isError) && (
        <Notice tone="danger">{getErrorMessage(archivar.error || borrar.error)}</Notice>
      )}

      {ministries.length === 0 ? (
        <EmptyState title={`Ningún ministerio en ${year}`}>
          {soloElMio
            ? "Todavía no te han asignado un ministerio para este año."
            : "Crea uno por cada ministerio que maneje su propio presupuesto: jóvenes, damas, misiones."}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {ministries.map((ministry) => (
            <Card key={ministry._id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span aria-hidden="true" className="text-2xl">
                    {ministry.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-extrabold text-ink truncate">
                      {ministry.name}
                      {ministry.archived && (
                        <span className="ml-2 text-xs font-semibold text-muted">archivado</span>
                      )}
                    </p>
                    {ministry.leader && (
                      <p className="text-xs text-muted truncate">
                        Lo lleva {ministry.leader.username}
                      </p>
                    )}
                  </div>
                </div>

                {puedeGestionar && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditando(ministry);
                        setCreando(false);
                      }}
                      aria-label={`Editar ${ministry.name}`}
                      className="h-9 w-9 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface-2"
                    >
                      <LuPencil aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        archivar.mutate({ id: ministry._id, archived: !ministry.archived })
                      }
                      aria-label={
                        ministry.archived ? `Recuperar ${ministry.name}` : `Archivar ${ministry.name}`
                      }
                      className="h-9 w-9 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface-2"
                    >
                      {ministry.archived ? (
                        <LuArchiveRestore aria-hidden="true" />
                      ) : (
                        <LuArchive aria-hidden="true" />
                      )}
                    </button>
                    {ministry.expenses === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`¿Borrar el ministerio ${ministry.name}?`))
                            borrar.mutate(ministry._id);
                        }}
                        aria-label={`Borrar ${ministry.name}`}
                        className="h-9 w-9 grid place-items-center rounded-full text-muted hover:text-danger hover:bg-surface-2"
                      >
                        <LuTrash2 aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <MinistryBar ministry={ministry} currency={currency} />
              </div>

              {ministry.expenses > 0 && (
                <div className="mt-3 pt-3 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setAbierto(abierto === ministry._id ? null : ministry._id)}
                    aria-expanded={abierto === ministry._id}
                    className="text-sm font-semibold text-muted hover:text-ink"
                  >
                    {abierto === ministry._id
                      ? "Ocultar los gastos"
                      : `Ver los ${ministry.expenses} gastos`}
                  </button>
                  {abierto === ministry._id && (
                    <Expenses ministry={ministry} currency={currency} />
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MinistriesPage;
