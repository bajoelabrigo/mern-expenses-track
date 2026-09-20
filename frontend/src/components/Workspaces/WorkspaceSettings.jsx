import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import {
  deleteWorkspaceAPI,
  removeWorkspaceLogoAPI,
  setWorkspaceLogoAPI,
  updateWorkspaceAPI,
} from "../../services/workspaces/workspaceService";
import { useWorkspace, WORKSPACES_KEY } from "../../hooks/useWorkspace";
import { setWorkspaceAction } from "../../redux/slice/workspaceSlice";
import { getErrorMessage } from "../../lib/axios";
import { CURRENCIES } from "../../lib/money";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Card, Field, Input, Notice, PageHeader, Select } from "../ui";
import LogoCard from "./LogoCard";
import PublicLinkCard from "./PublicLinkCard";

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
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Ajustes del espacio" subtitle={workspace.name} />

      <div className="space-y-6">
        <Card
          as="form"
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate({ id: workspace._id, ...form, name: form.name.trim() });
          }}
          className="p-5 space-y-4"
        >
          {updateMutation.isError && (
            <AlertMessage type="error" message={getErrorMessage(updateMutation.error)} />
          )}
          {updateMutation.isSuccess && <AlertMessage type="success" message="Cambios guardados." />}

          <Field label="Nombre" htmlFor="settings-name">
            <Input
              id="settings-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={2}
              maxLength={80}
            />
          </Field>

          <Field label="Moneda" htmlFor="settings-currency">
            <Select
              id="settings-currency"
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
          {currencyChanged && (
            <Notice tone="warning">
              Cambiar la moneda no convierte los montos: 100 seguirá siendo 100, pero en{" "}
              {form.currency}. Úsalo para corregir una moneda mal elegida.
            </Notice>
          )}

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </Card>

        <LogoCard
          workspace={workspace}
          onDone={() => queryClient.invalidateQueries({ queryKey: WORKSPACES_KEY })}
          upload={setWorkspaceLogoAPI}
          remove={removeWorkspaceLogoAPI}
        />

        {workspace.kind === "iglesia" && <PublicLinkCard workspace={workspace} />}

        {can("workspace:delete") && (
          <Card as="section" aria-labelledby="borrar-espacio" className="p-5 space-y-4">
            <div>
              <h2 id="borrar-espacio" className="text-lg font-extrabold text-danger">
                Borrar el espacio
              </h2>
              <p className="mt-1 text-sm text-ink-2 leading-relaxed">
                Se borran para siempre todos sus movimientos, categorías, miembros e historial. No se
                puede deshacer. Si quieres conservar los datos, descarga antes el Excel desde
                Movimientos.
              </p>
            </div>
            {deleteMutation.isError && (
              <AlertMessage type="error" message={getErrorMessage(deleteMutation.error)} />
            )}
            <Field
              label={
                <>
                  Escribe <strong className="text-ink">{workspace.name}</strong> para confirmar
                </>
              }
              htmlFor="confirm-name"
            >
              <Input
                id="confirm-name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Button
              variant="danger"
              disabled={confirmName !== workspace.name || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ id: workspace._id, confirmName })}
            >
              {deleteMutation.isPending ? "Borrando…" : "Borrar definitivamente"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WorkspaceSettings;
