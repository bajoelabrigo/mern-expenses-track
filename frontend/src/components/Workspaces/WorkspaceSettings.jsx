import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import {
  deleteWorkspaceAPI,
  updateWorkspaceAPI,
} from "../../services/workspaces/workspaceService";
import { useWorkspace, WORKSPACES_KEY } from "../../hooks/useWorkspace";
import { setWorkspaceAction } from "../../redux/slice/workspaceSlice";
import { getErrorMessage } from "../../lib/axios";
import { CURRENCIES } from "../../lib/money";
import AlertMessage from "../Alert/AlertMessage";

const WorkspaceSettings = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { workspace, can } = useWorkspace();

  const [form, setForm] = useState({ name: "", currency: "USD" });
  const [confirmName, setConfirmName] = useState("");

  //! El formulario se rellena cuando llega el espacio (o si se cambia de espacio)
  useEffect(() => {
    if (workspace) setForm({ name: workspace.name, currency: workspace.currency });
  }, [workspace]);

  const updateMutation = useMutation({
    mutationFn: updateWorkspaceAPI,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKSPACES_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkspaceAPI,
    onSuccess: async () => {
      dispatch(setWorkspaceAction(null));
      queryClient.clear();
      navigate("/espacios", { replace: true });
    },
  });

  if (!workspace) return <AlertMessage type="loading" message="Cargando espacio..." />;
  if (!can("workspace:manage")) return <Navigate to="/espacios" replace />;

  const currencyChanged = form.currency !== workspace.currency;

  return (
    <div className="max-w-2xl mx-auto my-8 px-2 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Ajustes del espacio</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate({ id: workspace._id, ...form, name: form.name.trim() });
        }}
        className="bg-white p-5 rounded-lg shadow border border-gray-200 space-y-4"
      >
        {updateMutation.isError && (
          <AlertMessage type="error" message={getErrorMessage(updateMutation.error)} />
        )}
        {updateMutation.isSuccess && (
          <AlertMessage type="success" message="Cambios guardados" />
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="settings-name" className="text-sm text-gray-700">
            Nombre
          </label>
          <input
            id="settings-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            minLength={2}
            maxLength={80}
            className="p-2 rounded-md border border-gray-300"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="settings-currency" className="text-sm text-gray-700">
            Moneda
          </label>
          <select
            id="settings-currency"
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
          {currencyChanged && (
            <p className="text-xs text-amber-700">
              Cambiar la moneda no convierte los montos: 100 seguirá siendo 100, pero
              en {form.currency}. Úsalo para corregir una moneda mal elegida.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-60"
        >
          {updateMutation.isPending ? "Guardando..." : "Guardar"}
        </button>
      </form>

      {can("workspace:delete") && (
        <section className="bg-white p-5 rounded-lg shadow border border-red-200 space-y-3">
          <h2 className="text-lg font-semibold text-red-700">Borrar el espacio</h2>
          <p className="text-sm text-gray-600">
            Se borran para siempre todos sus movimientos, categorías, miembros e
            historial. No se puede deshacer. Si quieres conservar los datos, exporta
            antes el Excel desde el panel.
          </p>
          {deleteMutation.isError && (
            <AlertMessage type="error" message={getErrorMessage(deleteMutation.error)} />
          )}
          <label htmlFor="confirm-name" className="block text-sm text-gray-700">
            Escribe <strong>{workspace.name}</strong> para confirmar
          </label>
          <input
            id="confirm-name"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            className="w-full p-2 rounded-md border border-gray-300"
            autoComplete="off"
          />
          <button
            type="button"
            disabled={confirmName !== workspace.name || deleteMutation.isPending}
            onClick={() => deleteMutation.mutate({ id: workspace._id, confirmName })}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md disabled:opacity-40"
          >
            {deleteMutation.isPending ? "Borrando..." : "Borrar definitivamente"}
          </button>
        </section>
      )}
    </div>
  );
};

export default WorkspaceSettings;
