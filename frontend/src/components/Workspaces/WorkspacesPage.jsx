import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
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
    <div className="max-w-3xl mx-auto my-8 px-2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-800">Mis espacios</h1>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Crear espacio
          </button>
        )}
      </div>

      <p className="text-sm text-gray-600">
        Cada espacio tiene sus propios movimientos, categorías y miembros. Usa uno
        personal para tus finanzas y uno por cada iglesia o ministerio que lleves.
      </p>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-5 rounded-lg shadow space-y-4 border border-gray-200"
        >
          <h2 className="text-lg font-semibold text-gray-800">Nuevo espacio</h2>

          {createMutation.isError && (
            <AlertMessage type="error" message={getErrorMessage(createMutation.error)} />
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="ws-name" className="text-sm text-gray-700">
              Nombre
            </label>
            <input
              id="ws-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Iglesia Betel, Ministerio de jóvenes, Mis finanzas..."
              className="p-2 rounded-md border border-gray-300"
              required
              minLength={2}
              maxLength={80}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="ws-kind" className="text-sm text-gray-700">
                Tipo
              </label>
              <select
                id="ws-kind"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
                className="p-2 rounded-md border border-gray-300"
              >
                <option value="iglesia">⛪ Iglesia o ministerio</option>
                <option value="personal">👤 Personal</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="ws-currency" className="text-sm text-gray-700">
                Moneda
              </label>
              <select
                id="ws-currency"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="p-2 rounded-md border border-gray-300"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-md border border-gray-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-60"
            >
              {createMutation.isPending ? "Creando..." : "Crear y abrir"}
            </button>
          </div>
        </form>
      )}

      {defaultMutation.isError && (
        <AlertMessage type="error" message={getErrorMessage(defaultMutation.error)} />
      )}

      {isLoading ? (
        <AlertMessage type="loading" message="Cargando espacios..." />
      ) : (
        <ul className="space-y-3">
          {workspaces.map((w) => {
            const isCurrent = current?._id === w._id;
            return (
              <li
                key={w._id}
                className={`bg-white p-4 rounded-lg shadow border flex flex-wrap items-center justify-between gap-3 ${
                  isCurrent ? "border-blue-400" : "border-gray-200"
                }`}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">
                    {w.kind === "iglesia" ? "⛪" : "👤"} {w.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {ROLE_LABELS[w.role]} · {w.currency}
                    {w.isDefault && " · Se abre al iniciar sesión"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!w.isDefault && (
                    <button
                      type="button"
                      onClick={() => defaultMutation.mutate(w._id)}
                      disabled={defaultMutation.isPending}
                      className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
                    >
                      Predeterminado
                    </button>
                  )}
                  {w.permissions.includes("workspace:manage") && (
                    <Link
                      to="/espacio/ajustes"
                      onClick={() => switchWorkspace(w._id)}
                      className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
                    >
                      Ajustes
                    </Link>
                  )}
                  {isCurrent ? (
                    <span className="text-sm px-3 py-1.5 rounded-md bg-blue-50 text-blue-700">
                      Abierto
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => abrir(w._id)}
                      className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Abrir
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default WorkspacesPage;
