import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  LineElement,
  PointElement,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import { useQuery } from "@tanstack/react-query";
import {
  getTransactionByPeriodAPI,
  exportTransactionExcelAPI,
} from "../../services/transactions/transactionService";
import { listCategoriesAPI } from "../../services/category/categoryService";
import { BsCashCoin, BsHouseDash } from "react-icons/bs";
import { GrMoney } from "react-icons/gr";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title
);

const periods = [
  { label: "Mensual", value: "monthly" },
  { label: "Bimestral", value: "bimonthly" },
  { label: "Trimestral", value: "quarterly" },
  { label: "6 Meses", value: "semiannual" },
  { label: "Anual", value: "annual" },
];

const TransactionChart = () => {
  const { user } = useSelector((state) => state.auth);

  const [selectedPeriod, setSelectedPeriod] = useState("monthly");
  const [selectedType, setSelectedType] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: categories = [] } = useQuery({
    queryFn: listCategoriesAPI,
    queryKey: ["list-categories"],
  });

  const { data: transactions = [] } = useQuery({
    queryFn: () =>
      getTransactionByPeriodAPI({
        period: selectedPeriod,
        type: selectedType,
        category: selectedCategory,
        startDate,
        endDate,
      }),
    queryKey: [
      "transactions",
      selectedPeriod,
      selectedType,
      selectedCategory,
      startDate,
      endDate,
    ],
  });

  const filteredTransactions = useMemo(() => transactions, [transactions]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, t) => {
        if (t.type === "income") acc.income += Number(t.amount);
        else acc.expense += Number(t.amount);
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    const map = {};
    filteredTransactions.forEach((t) => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
      if (!map[key]) map[key] = { income: 0, expense: 0 };
      if (t.type === "income") map[key].income += Number(t.amount);
      else map[key].expense += Number(t.amount);
    });
    const labels = Object.keys(map).sort();
    return {
      labels,
      datasets: [
        {
          label: "Ingresos",
          data: labels.map((l) => map[l].income),
          backgroundColor: "#36A2EB",
        },
        {
          label: "Gastos",
          data: labels.map((l) => map[l].expense),
          backgroundColor: "#FF6384",
        },
      ],
    };
  }, [filteredTransactions]);

  const handleExportExcel = async () => {
    const response = await exportTransactionExcelAPI(selectedPeriod);
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `transactions_${selectedPeriod}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 bg-white rounded-lg shadow-xl border border-gray-200">
      <h2 className="text-2xl font-bold text-center">
        Resumen de Transacciones
      </h2>
      <h3 className="text-xl font-semibold text-center">{user?.iglesia}</h3>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 justify-center">
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="border p-2 rounded-md"
        >
          {periods.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="border p-2 rounded-md"
        >
          <option value="">Todos los tipos</option>
          <option value="income">Ingreso</option>
          <option value="expense">Gasto</option>
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="border p-2 rounded-md"
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Nuevos filtros de fecha */}
        <div className="flex flex-col">
          <label htmlFor="startDate" className="text-sm text-gray-600 mb-1">
            Fecha inicial
          </label>
          <input
            type="date"
            name="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-2 rounded-lg border-gray-300 border"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="endDate" className="text-sm text-gray-600 mb-1">
            Fecha final
          </label>
          <input
            type="date"
            name="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-2 rounded-lg border-gray-300 border"
          />
        </div>

        <button
          onClick={handleExportExcel}
          className="bg-green-500 text-white px-4 py-2 rounded-md"
        >
          Exportar Excel
        </button>
      </div>

      {/* Gráfico Dona */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="relative w-full flex justify-center items-center h-72">
          <div className="w-64 h-64 relative">
            <Doughnut
              data={{
                labels: ["Ingresos", "Gastos"],
                datasets: [
                  {
                    data: [totals.income, totals.expense],
                    backgroundColor: ["#36A2EB", "#FF6384"],
                  },
                ],
              }}
              options={{
                plugins: {
                  legend: { position: "bottom" },
                  title: {
                    display: true,
                    text: "Ingreso vs Gasto",
                    font: { size: 16 },
                  },
                },
                cutout: "80%",
                maintainAspectRatio: false,
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <GrMoney className="text-3xl text-blue-400 mb-1" />
              <span className="text-sm font-semibold text-gray-600">
                Balance
              </span>
              <span className="text-xl font-bold text-gray-900">
                S/. {(totals.income - totals.expense).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Totales */}
        <div className="flex flex-col items-center justify-center">
          <h3 className="text-2xl font-bold text-[#36A2EB]">Total Ingresos</h3>
          <div className="flex gap-2 items-center">
            <BsCashCoin className="text-3xl text-green-500" />
            <span className="text-2xl font-bold">
              S/. {totals.income.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
          <h3 className="text-2xl font-bold text-[#FF6384]">Total Gastos</h3>
          <div className="flex gap-2 items-center">
            <BsHouseDash className="text-3xl text-red-500" />
            <span className="text-2xl font-bold">
              S/. {totals.expense.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Gráfico de Barras */}
      <div className="mt-8 flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold mb-4 text-center">
          Evolución mensual de transacciones
        </h2>
        <div className="w-full max-w-4xl h-[400px]">
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: "top" },
                title: {
                  display: true,
                  text: `Historial de Ingresos y Gastos (${
                    periods.find((p) => p.value === selectedPeriod)?.label
                  })`,
                },
              },
            }}
          />
        </div>
      </div>

      {/* Gráfico de Línea */}
      <div className="mt-8 flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold mb-4 text-center">
          Tendencia mensual
        </h2>
        <div className="w-full max-w-4xl h-[400px]">
          <Line
            data={chartData}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: {
                  display: true,
                  text: `Tendencia mensual (${
                    periods.find((p) => p.value === selectedPeriod)?.label
                  })`,
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default TransactionChart;
