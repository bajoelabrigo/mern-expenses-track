import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { LuPlus, LuSettings } from "react-icons/lu";
import {
  createWorkspaceAPI,
  setDefaultWorkspaceAPI,
} from "../../services/workspaces/workspaceService";
import { useWorkspace, WORKSPACES_KEY } from "../../hooks/useWorkspace";
import { updateUserAction } from "../../redux/slice/authSlice";
import { getErrorMessage } from "../../lib/axios";
import { CURRENCIES } from "../../lib/money";
import { ROLE_LABELS } from "../../lib/roles";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Card, Field, Input, ListGroup, PageHeader, Segmented, Select } from "../ui";

const KINDS = [
  { value: "iglesia", label: "Iglesia o ministerio" },
  { value: "personal", label: "Personal" },
];

const SMALL_ACTION =
  "inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-surface-2 text-xs font-semibold text-ink-2 hover:text-ink disabled:opacity-50 transition";

//! Mis espacios: cambiar al que se quiera, elegir el predeterminado y crear
//! uno nuevo.
const WorkspacesPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { workspace: current, workspaces, isLoading, switchWorkspace } = useWorkspace();

  const [showForm, setShowForm] = useState(searchParams.get("nuevo") === "1");
  const [form, setForm] = useState({ name: "", kind: "iglesia", currency: "USD" });

  const createMutation = useMutation({
    mutationFn: createWorkspaceAPI,
    onSuccess: async (created) => {
      //! Se espera a que la lista incluya el nuevo antes de cambiar a él
      await queryClient.invalidateQueries({ queryKey: WORKSPACES_KEY });
      switchWorkspace(created._id);
      navigate("/dashboard");
    },
  });

  const defaultMutation = useMutation({
    mutationFn: setDefaultWorkspaceAPI,
    onSuccess: (data) => {
      dispatch(updateUserAction(data.user));
      queryClient.invalidateQueries({ queryKey: WORKSPACES_KEY });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return;
    createMutation.mutate({ ...form, name: form.name.trim() });
  };

  const abrir = (id) => {
    switchWorkspace(id);
    navigate("/dashboard");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Mis espacios"
        subtitle="Cada espacio tiene sus propios movimientos, categorías y miembros."
        action={
          !showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <LuPlus aria-hidden="true" /> Nuevo
            </Button>
          )
        }
      />

      <div className="space-y-6">
        {showForm && (
          <Card as="form" onSubmit={handleSubmit} className="p-5 space-y-4">
            <h2 className="text-lg font-extrabold text-ink">Nuevo espacio</h2>

            {createMutation.isError && (
              <AlertMessage type="error" message={getErrorMessage(createMutation.error)} />
            )}

            <Segmented
              label="Tipo de espacio"
              options={KINDS}
              value={form.kind}
              onChange={(kind) => setForm({ ...form, kind })}
              className="shadow-none bg-surface-2"
            />

            <Field label="Nombre" htmlFor="ws-name">
              <Input
                id="ws-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={form.kind === "iglesia" ? "Iglesia Betel, Ministerio de jóvenes…" : "Mis finanzas"}
                required
                minLength={2}
                maxLength={80}
              />
            </Field>

            <Field label="Moneda" htmlFor="ws-currency">
              <Select
                id="ws-currency"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creando…" : "Crear y abrir"}
              </Button>
            </div>
          </Card>
        )}

        {defaultMutation.isError && (
          <AlertMessage type="error" message={getErrorMessage(defaultMutation.error)} />
        )}

        {isLoading ? (
          <AlertMessage type="loading" message="Cargando espacios…" />
        ) : (
          <ListGroup>
            {workspaces.map((w) => {
              const isCurrent = current?._id === w._id;
              return (
                <div key={w._id} className="px-4 py-3.5 space-y-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="h-11 w-11 shrink-0 rounded-xl bg-surface-2 grid place-items-center text-xl"
                    >
                      {w.kind === "iglesia" ? "⛪" : "👤"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink truncate">{w.name}</p>
                      <p className="text-sm text-muted">
                        {ROLE_LABELS[w.role]} · {w.currency}
                      </p>
                    </div>
                    {isCurrent ? (
                      <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-accent-soft text-ink">
                        Abierto
                      </span>
                    ) : (
                      <Button size="sm" onClick={() => abrir(w._id)}>
                        Abrir
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-14">
                    {w.isDefault ? (
                      <span className="text-xs font-semibold text-muted">Se abre al iniciar sesión</span>
                    ) : (
                      <button
                        type="button"
                        className={SMALL_ACTION}
                        onClick={() => defaultMutation.mutate(w._id)}
                        disabled={defaultMutation.isPending}
                      >
                        Abrir al iniciar sesión
                      </button>
                    )}
                    {w.permissions.includes("workspace:manage") && (
                      <Link
                        to="/espacio/ajustes"
                        onClick={() => switchWorkspace(w._id)}
                        className={SMALL_ACTION}
                      >
                        <LuSettings aria-hidden="true" /> Ajustes
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </ListGroup>
        )}
      </div>
    </div>
  );
};

export default WorkspacesPage;
