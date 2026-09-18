import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getAllUsersAPI } from "../../services/admin/adminService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";

const AdminUsersList = () => {
  const navigate = useNavigate();

  const {
    data: users = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin-users"],
    queryFn: getAllUsersAPI,
  });

  if (isLoading) return <p className="p-4">Cargando usuarios...</p>;
  if (isError) {
    return (
      <div className="p-4">
        <AlertMessage type="error" message={getErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded shadow overflow-x-auto">
      <h2 className="text-2xl font-bold mb-4">Lista de usuarios</h2>
      <table className="w-full border text-left">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Usuario</th>
            <th className="p-2">Correo</th>
            <th className="p-2">Iglesia</th>
            <th className="p-2">Rol</th>
            <th className="p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id} className="border-t">
              {/* El modelo guarda "username", antes se leía u.name y salía vacío */}
              <td className="p-2">{u.username}</td>
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.iglesia}</td>
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
              <td className="p-2">
                <button
                  type="button"
                  onClick={() => navigate(`/admin/dashboard/${u._id}`)}
                  className="text-blue-600 hover:underline"
                >
                  Ver dashboard
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminUsersList;
