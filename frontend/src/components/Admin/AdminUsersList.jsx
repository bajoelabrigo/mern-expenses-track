import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getAllUsersAPI, getAllWorkspacesAPI } from "../../services/admin/adminService";
import { useWorkspace } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import { ROLE_LABELS } from "../../lib/roles";
import AlertMessage from "../Alert/AlertMessage";

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
    <div className="p-4 bg-white rounded shadow overflow-x-auto">
      <h2 className="text-2xl font-bold mb-4">Administración</h2>

      <div className="mb-4 flex gap-6 border-b border-gray-100">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id}
            className={`border-b-2 py-2 text-sm font-medium ${
              tab === t.id ? "text-blue-600 border-blue-600" : "border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active.isLoading && <p className="p-4">Cargando...</p>}
      {active.isError && (
        <AlertMessage type="error" message={getErrorMessage(active.error)} />
      )}

      {tab === "usuarios" && usersQuery.data && (
        <table className="w-full border text-left">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2">Usuario</th>
              <th className="p-2">Correo</th>
              <th className="p-2">Espacios</th>
              <th className="p-2">Rol</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.data.map((u) => (
              <tr key={u._id} className="border-t align-top">
                <td className="p-2">{u.username}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">
                  <ul className="space-y-1">
                    {u.workspaces.map((w) => (
                      <li key={w._id} className="text-sm">
                        <button
                          type="button"
                          onClick={() => entrar(w._id)}
                          className="text-blue-600 hover:underline"
                        >
                          {w.kind === "iglesia" ? "⛪" : "👤"} {w.name}
                        </button>{" "}
                        <span className="text-gray-500">({ROLE_LABELS[w.role]})</span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="p-2">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      u.role === "admin"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "espacios" && workspacesQuery.data && (
        <table className="w-full border text-left">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2">Espacio</th>
              <th className="p-2">Moneda</th>
              <th className="p-2">Miembros</th>
              <th className="p-2">Movimientos</th>
              <th className="p-2">Creado</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {workspacesQuery.data.map((w) => (
              <tr key={w._id} className="border-t">
                <td className="p-2">
                  {w.kind === "iglesia" ? "⛪" : "👤"} {w.name}
                </td>
                <td className="p-2">{w.currency}</td>
                <td className="p-2">{w.members}</td>
                <td className="p-2">{w.transactions}</td>
                <td className="p-2">{new Date(w.createdAt).toLocaleDateString("es")}</td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => entrar(w._id)}
                    className="text-blue-600 hover:underline"
                  >
                    Entrar como soporte
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AdminUsersList;
