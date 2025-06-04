import React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUserDashboardAPI } from "./adminService";

const AdminUserDashboard = () => {
  const { id } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-dashboard", id],
    queryFn: () => getUserDashboardAPI(id),
    enabled: !!id,
  });

  if (isLoading) return <p>Cargando datos del usuario...</p>;
  if (error) return <p>Error al cargar el dashboard del usuario</p>;

  const { transactions, categories } = data;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Dashboard de Usuario</h2>

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Categorías</h3>
        <ul className="space-y-1">
          {categories.map((c) => (
            <li key={c._id}>
              <span>
                {c.icon} {c.name} ({c.type})
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">Transacciones</h3>
        <ul className="space-y-1">
          {transactions.map((t) => (
            <li key={t._id}>
              {t.date.slice(0, 10)} - {t.description || "Sin descripción"} - S/.
              {t.amount} ({t.type})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AdminUserDashboard;
