import React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUserDashboardAPI } from "./adminService";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

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

  const monthlySummary = transactions.reduce((acc, t) => {
    const month = new Date(t.date).toLocaleString("default", {
      month: "short",
      year: "numeric",
    });
    if (!acc[month]) {
      acc[month] = { income: 0, expense: 0 };
    }
    if (t.type === "income") {
      acc[month].income += t.amount;
    } else {
      acc[month].expense += t.amount;
    }
    return acc;
  }, {});

  const labels = Object.keys(monthlySummary);
  const incomeData = labels.map((m) => monthlySummary[m].income);
  const expenseData = labels.map((m) => monthlySummary[m].expense);
  const netData = labels.map(
    (m) => monthlySummary[m].income - monthlySummary[m].expense
  );

  const chartData = {
    labels,
    datasets: [
      {
        label: "Ingresos",
        data: incomeData,
        backgroundColor: "rgba(54, 162, 235, 0.6)",
      },
      {
        label: "Egresos",
        data: expenseData,
        backgroundColor: "rgba(255, 99, 132, 0.6)",
      },
      {
        label: "Balance Neto",
        data: netData,
        backgroundColor: "rgba(75, 192, 192, 0.6)",
      },
    ],
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Dashboard de Usuario</h2>

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Resumen Mensual</h3>
        <Bar data={chartData} />
      </div>

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
