import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getAllUsersAPI, getAllWorkspacesAPI } from "../../services/admin/adminService";
import { useWorkspace } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import { ROLE_LABELS } from "../../lib/roles";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Chip, ListGroup, PageHeader } from "../ui";
import { initials } from "../ui/styles";

const TABS = [
  { id: "espacios", label: "Espacios" },
  { id: "usuarios", label: "Usuarios" },
];

//! Panel del administrador de la PLATAFORMA. Para revisar o corregir los
//! libros de un espacio se entra a él como soporte: se ven las mismas
//! pantallas que su propietario y cada cambio queda en su historial.
const AdminUsersList = () => {
  const navigate = useNavigate();
  const { switchWorkspace } = useWorkspace();
  const [tab, setTab] = useState("espacios");

  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: getAllUsersAPI });
  const workspacesQuery = useQuery({
    queryKey: ["admin-workspaces"],
    queryFn: getAllWorkspacesAPI,
  });

  const entrar = (id) => {
    switchWorkspace(id);
    navigate("/dashboard");
  };

  const active = tab === "usuarios" ? usersQuery : workspacesQuery;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Administración"
        subtitle="Toda la plataforma. Al entrar como soporte, cada cambio queda en el historial del espacio."
      />

      <div className="space-y-4">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <Chip key={t.id} selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>

        {active.isLoading && <AlertMessage type="loading" message="Cargando…" />}
        {active.isError && <AlertMessage type="error" message={getErrorMessage(active.error)} />}

        {tab === "espacios" && workspacesQuery.data && (
          <ListGroup>
            {workspacesQuery.data.map((w) => (
              <div key={w._id} className="px-4 py-3.5 flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="h-11 w-11 shrink-0 rounded-xl bg-surface-2 grid place-items-center text-xl"
                >
                  {w.kind === "iglesia" ? "⛪" : "👤"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink truncate">{w.name}</p>
                  <dl className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
                    <Stat label="Miembros" value={w.members} />
                    <Stat label="Movimientos" value={w.transactions} />
                    <Stat label="Moneda" value={w.currency} />
                    <Stat label="Creado" value={new Date(w.createdAt).toLocaleDateString("es")} />
                  </dl>
                  <Button variant="secondary" size="sm" className="mt-3" onClick={() => entrar(w._id)}>
                    Entrar como soporte
                  </Button>
                </div>
              </div>
            ))}
          </ListGroup>
        )}

        {tab === "usuarios" && usersQuery.data && (
          <ListGroup>
            {usersQuery.data.map((u) => (
              <div key={u._id} className="px-4 py-3.5 flex gap-3">
                <span
                  aria-hidden="true"
                  className="h-11 w-11 shrink-0 rounded-full bg-surface-2 grid place-items-center text-sm font-bold text-ink-2"
                >
                  {initials(u.username)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink truncate">{u.username}</p>
                    {u.role === "admin" && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent-soft text-ink">
                        admin
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted truncate">{u.email}</p>
                  {u.workspaces.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {u.workspaces.map((w) => (
                        <li key={w._id}>
                          <button
                            type="button"
                            onClick={() => entrar(w._id)}
                            className="h-8 px-3 rounded-full bg-surface-2 text-xs font-semibold text-ink-2 hover:text-ink transition"
                          >
                            {w.kind === "iglesia" ? "⛪" : "👤"} {w.name}{" "}
                            <span className="font-normal text-muted">({ROLE_LABELS[w.role]})</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </ListGroup>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="flex gap-1">
    <dt>{label}</dt>
    <dd className="font-semibold text-ink-2 tabular">{value}</dd>
  </div>
);

export default AdminUsersList;
