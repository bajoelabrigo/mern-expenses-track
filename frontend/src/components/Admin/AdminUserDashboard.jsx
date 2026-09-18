import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { getUserDashboardAPI } from "../../services/admin/adminService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const AdminUserDashboard = () => {
  const { id } = useParams();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["user-dashboard", id],
    queryFn: () => getUserDashboardAPI(id),
    enabled: Boolean(id),
  });

  //! useMemo evita que el array recién creado dispare el cálculo en cada render
  const transactions = useMemo(() => data?.transactions || [], [data]);
  const categories = data?.categories || [];
  const totals = data?.totals || { income: 0, expense: 0, balance: 0 };

  const chartData = useMemo(() => {
    const resumen = transactions.reduce((acc, t) => {
      const mes = new Date(t.date).toLocaleString("es-PE", {
        month: "short",
        year: "numeric",
      });
      if (!acc[mes]) acc[mes] = { income: 0, expense: 0 };
      if (t.type === "income") acc[mes].income += t.amount;
      else acc[mes].expense += t.amount;
      return acc;
    }, {});

    const labels = Object.keys(resumen);
    return {
      labels,
      datasets: [
        {
          label: "Ingresos",
          data: labels.map((m) => resumen[m].income),
          backgroundColor: "rgba(54, 162, 235, 0.6)",
        },
        {
          label: "Egresos",
          data: labels.map((m) => resumen[m].expense),
          backgroundColor: "rgba(255, 99, 132, 0.6)",
        },
        {
          label: "Balance neto",
          data: labels.map((m) => resumen[m].income - resumen[m].expense),
          backgroundColor: "rgba(75, 192, 192, 0.6)",
        },
      ],
    };
  }, [transactions]);

  if (isLoading) return <p className="p-6">Cargando datos del usuario...</p>;
  if (isError) {
    return (
      <div className="p-6">
        <AlertMessage type="error" message={getErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">
          Dashboard de {data?.user?.username}
        </h2>
        <Link to="/admin/users" className="text-blue-600 hover:underline">
          ← Volver al listado
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Ingresos</p>
          <p className="text-xl font-bold">S/. {totals.income.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Gastos</p>
          <p className="text-xl font-bold">S/. {totals.expense.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Balance</p>
          <p className="text-xl font-bold">S/. {totals.balance.toFixed(2)}</p>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">Resumen mensual</h3>
        {transactions.length > 0 ? (
          <Bar data={chartData} />
        ) : (
          <p className="text-gray-500">Este usuario no tiene transacciones.</p>
        )}
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">Categorías</h3>
        {categories.length > 0 ? (
          <ul className="space-y-1">
            {categories.map((c) => (
              <li key={c._id} className="capitalize">
                {c.icon} {c.name} ({c.type === "income" ? "ingreso" : "gasto"})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">Sin categorías.</p>
        )}
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">
          Transacciones{" "}
          <span className="text-sm font-normal text-gray-500">
            (mostrando {transactions.length} de {data?.total || 0})
          </span>
        </h3>
        <ul className="space-y-1">
          {transactions.map((t) => (
            <li key={t._id}>
              {new Date(t.date).toLocaleDateString("es-PE")} -{" "}
              {t.description || "Sin descripción"} - S/.
              {Number(t.amount).toFixed(2)} (
              {t.type === "income" ? "ingreso" : "gasto"})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AdminUserDashboard;
