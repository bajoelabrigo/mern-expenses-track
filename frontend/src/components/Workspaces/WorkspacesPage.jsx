import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { LuPlus, LuSettings, LuUserPlus } from "react-icons/lu";
import {
  createWorkspaceAPI,
  listMyJoinRequestsAPI,
  requestJoinAPI,
  searchChurchesAPI,
  setDefaultWorkspaceAPI,
  withdrawJoinRequestAPI,
} from "../../services/workspaces/workspaceService";
import { useWorkspace, WORKSPACES_KEY } from "../../hooks/useWorkspace";
import { updateUserAction } from "../../redux/slice/authSlice";
import { getErrorMessage } from "../../lib/axios";
import { CURRENCIES } from "../../lib/money";
import { ROLE_LABELS } from "../../lib/roles";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Card, Field, Input, ListGroup, Notice, PageHeader, Segmented, Select, Textarea } from "../ui";

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

  //! Unirme a una iglesia que ya existe: se busca por nombre y se pide entrar.
  //! La solicitud NO da acceso: la aprueba un propietario o tesorero.
  const [showJoin, setShowJoin] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [nombreBuscado, setNombreBuscado] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [elegida, setElegida] = useState(null);

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

  //! La búsqueda espera media tecla: no se pregunta por cada letra
  const buscar = (valor) => {
    setBusqueda(valor);
    setElegida(null);
  };

  useEffect(() => {
    const t = setTimeout(() => setNombreBuscado(busqueda.trim()), 500);
    return () => clearTimeout(t);
  }, [busqueda]);

  const iglesiasQuery = useQuery({
    queryKey: ["iglesias-buscar", nombreBuscado],
    queryFn: () => searchChurchesAPI(nombreBuscado),
    enabled: showJoin && nombreBuscado.length >= 3,
    staleTime: 60 * 1000,
    retry: false,
  });

  const solicitudesQuery = useQuery({
    queryKey: ["mis-solicitudes"],
    queryFn: listMyJoinRequestsAPI,
    enabled: showJoin,
  });

  const joinMutation = useMutation({
    mutationFn: requestJoinAPI,
    onSuccess: () => {
      setMensaje("");
      setElegida(null);
      queryClient.invalidateQueries({ queryKey: ["mis-solicitudes"] });
      queryClient.invalidateQueries({ queryKey: ["iglesias-buscar", nombreBuscado] });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: withdrawJoinRequestAPI,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mis-solicitudes"] }),
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
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setShowJoin((v) => !v);
                  setElegida(null);
                }}
              >
                <LuUserPlus aria-hidden="true" /> Unirme
              </Button>
              <Button size="sm" onClick={() => setShowForm(true)}>
                <LuPlus aria-hidden="true" /> Nuevo
              </Button>
            </div>
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

        {showJoin && (
          <Card className="p-5 space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-ink">Unirme a una iglesia que ya existe</h2>
              <p className="mt-1 text-sm text-muted">
                Si tu iglesia ya usa la app, no crees otra igual: pide entrar y un propietario o
                tesorero lo aprueba. Hasta entonces no ves sus cuentas.
              </p>
            </div>

            {joinMutation.isError && (
              <AlertMessage type="error" message={getErrorMessage(joinMutation.error)} />
            )}
            {joinMutation.isSuccess && (
              <Notice tone="success">{joinMutation.data.message}</Notice>
            )}
            {withdrawMutation.isError && (
              <AlertMessage type="error" message={getErrorMessage(withdrawMutation.error)} />
            )}

            <Field label="Nombre de la iglesia" htmlFor="buscar-iglesia" hint="Al menos 3 letras.">
              <Input
                id="buscar-iglesia"
                value={busqueda}
                onChange={(e) => buscar(e.target.value)}
                placeholder="Ministerio, Iglesia Betel…"
              />
            </Field>

            {nombreBuscado.length >= 3 && iglesiasQuery.isLoading && (
              <AlertMessage type="loading" message="Buscando…" />
            )}
            {iglesiasQuery.data?.length === 0 && (
              <p className="text-sm text-muted">
                No hay ninguna iglesia con ese nombre. Si es tu iglesia y todavía no está en la app,
                créala con «Nuevo».
              </p>
            )}

            {iglesiasQuery.data?.length > 0 && (
              <ListGroup className="bg-surface-2">
                {iglesiasQuery.data.map((ig) => (
                  <div key={ig._id} className="px-4 py-3 space-y-3">
                    <div className="flex items-start gap-3">
                      <span aria-hidden="true" className="h-11 w-11 shrink-0 rounded-xl bg-surface grid place-items-center text-xl">
                        ⛪
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink truncate">{ig.name}</p>
                        <p className="text-sm text-muted">
                          {ig.createdBy ? `La creó ${ig.createdBy}. ` : ""}
                          {ig.members === 1 ? "1 miembro" : `${ig.members} miembros`}
                          {ig.createdAt
                            ? ` · desde ${new Date(ig.createdAt).toLocaleDateString("es", { month: "long", year: "numeric" })}`
                            : ""}
                        </p>
                      </div>
                      {ig.isMember ? (
                        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-surface text-ink-2">
                          Ya eres miembro
                        </span>
                      ) : ig.requested ? (
                        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-accent-soft text-ink">
                          Pediste entrar
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => setElegida(ig._id)}>
                          Pedir entrar
                        </Button>
                      )}
                    </div>

                    {elegida === ig._id && (
                      <div className="space-y-2 pl-14">
                        <Textarea
                          aria-label={`Mensaje para ${ig.name}`}
                          value={mensaje}
                          onChange={(e) => setMensaje(e.target.value)}
                          placeholder="Preséntate: soy la tesorera, llevo los diezmos…"
                          maxLength={300}
                          className="min-h-20"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => setElegida(null)}>
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            disabled={joinMutation.isPending}
                            onClick={() => joinMutation.mutate({ id: ig._id, message: mensaje })}
                          >
                            {joinMutation.isPending ? "Enviando…" : "Enviar solicitud"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </ListGroup>
            )}

            {solicitudesQuery.data?.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-muted px-1">Esperando respuesta</h3>
                <ListGroup className="bg-surface-2">
                  {solicitudesQuery.data.map((s) => (
                    <div key={s._id} className="px-4 py-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink truncate">{s.workspaceName}</p>
                        <p className="text-sm text-muted">
                          Enviada el{" "}
                          {new Date(s.createdAt).toLocaleDateString("es", {
                            day: "numeric",
                            month: "long",
                          })}
                          . Falta que la aprueben.
                        </p>
                      </div>
                      <Button
                        variant="danger-ghost"
                        size="sm"
                        disabled={withdrawMutation.isPending}
                        onClick={() => withdrawMutation.mutate(s._id)}
                      >
                        Retirar
                      </Button>
                    </div>
                  ))}
                </ListGroup>
              </div>
            )}
          </Card>
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
