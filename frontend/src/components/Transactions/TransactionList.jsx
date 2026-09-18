import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { FaTrash, FaEdit } from "react-icons/fa";
import { Link } from "react-router-dom";
import {
  deleteTransactionAPI,
  listTransationsAPI,
} from "../../services/transactions/transactionService";
import { listCategoriesAPI } from "../../services/category/categoryService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";

const FILTROS_INICIALES = {
  startDate: "",
  endDate: "",
  type: "",
  category: "",
};

const TransactionList = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [filters, setFilters] = useState(FILTROS_INICIALES);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1); // cualquier cambio de filtro vuelve a la primera página
  };

  const limpiarFiltros = () => {
    setFilters(FILTROS_INICIALES);
    setPage(1);
  };

  const { data: categories = [] } = useQuery({
    queryFn: listCategoriesAPI,
    queryKey: ["list-categories"],
  });

  const { data, isLoading, isError, error } = useQuery({
    queryFn: () => listTransationsAPI({ ...filters, page, limit }),
    queryKey: ["list-transactions", filters, page, limit],
    //! API de React Query v5 (antes se usaba keepPreviousData: true, que se ignora)
    placeholderData: keepPreviousData,
  });

  const transactions = data?.transactions || [];
  const currentPage = data?.currentPage || 1;
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  const {
    mutateAsync: deleteTransaction,
    isError: isDeleteError,
    error: deleteError,
  } = useMutation({
    mutationFn: deleteTransactionAPI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta transacción?")) return;
    try {
      await deleteTransaction(id);
    } catch {
      // el mensaje se muestra con AlertMessage
    }
  };

  const getCategoryIcon = (categoryName) =>
    categories.find((c) => c.name === categoryName)?.icon || "💼";

  return (
    <div className="my-4 p-4 shadow-lg rounded-lg bg-white">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="flex flex-col">
          <label htmlFor="startDate" className="text-sm text-gray-600 mb-1">
            Fecha inicial
          </label>
          <input
            id="startDate"
            type="date"
            value={filters.startDate}
            onChange={handleFilterChange}
            name="startDate"
            className="p-2 rounded-lg border-gray-300 border"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="endDate" className="text-sm text-gray-600 mb-1">
            Fecha final
          </label>
          <input
            id="endDate"
            type="date"
            value={filters.endDate}
            onChange={handleFilterChange}
            name="endDate"
            className="p-2 rounded-lg border-gray-300 border"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="type" className="text-sm text-gray-600 mb-1">
            Tipo
          </label>
          <div className="relative">
            <select
              id="type"
              name="type"
              value={filters.type}
              onChange={handleFilterChange}
              className="w-full p-2 rounded-lg border-gray-300 border appearance-none"
            >
              <option value="">Todos los tipos</option>
              <option value="income">Ingreso</option>
              <option value="expense">Gasto</option>
            </select>
            <ChevronDownIcon className="w-5 h-5 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
        </div>

        <div className="flex flex-col">
          <label htmlFor="category" className="text-sm text-gray-600 mb-1">
            Categoría
          </label>
          <div className="relative">
            <select
              id="category"
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="w-full p-2 rounded-lg border-gray-300 border appearance-none"
            >
              <option value="">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category._id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="w-5 h-5 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
        </div>
      </div>

      <div className="mt-6 bg-gray-50 p-4 rounded-lg shadow-inner">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <h3 className="text-xl font-semibold text-gray-800">
            Transacciones filtradas{" "}
            <span className="text-sm font-normal text-gray-500">
              ({total} en total)
            </span>
          </h3>
          <button
            type="button"
            onClick={limpiarFiltros}
            className="text-sm text-blue-600 hover:underline"
          >
            Limpiar filtros
          </button>
        </div>

        {isError && (
          <AlertMessage type="error" message={getErrorMessage(error)} />
        )}
        {isDeleteError && (
          <AlertMessage type="error" message={getErrorMessage(deleteError)} />
        )}

        {isLoading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : transactions.length === 0 ? (
          <p className="text-gray-500">
            No hay transacciones para los filtros seleccionados.
          </p>
        ) : (
          <ul className="space-y-2">
            {transactions.map((transaction) => (
              <li
                key={transaction._id}
                className="bg-white p-3 rounded-md shadow border flex flex-wrap gap-2 justify-between items-center"
              >
                <div>
                  <span className="font-medium text-gray-600">
                    {new Date(transaction.date).toLocaleDateString("es-PE")}
                  </span>
                  <span
                    className={`ml-2 px-2 inline-flex text-xs font-semibold rounded-full ${
                      transaction.type === "income"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {transaction.type === "income" ? "Ingreso" : "Gasto"}
                  </span>
                  <span className="ml-2">
                    {getCategoryIcon(transaction.category)}
                  </span>
                  <span className="ml-2 font-semibold text-gray-800 capitalize">
                    {transaction.category} - S/.
                    {Number(transaction.amount).toFixed(2)}
                  </span>
                  {transaction.description && (
                    <span className="text-sm text-gray-600 italic ml-2">
                      {transaction.description}
                    </span>
                  )}
                </div>
                <div className="flex space-x-3">
                  <Link
                    to={`/update-transactions/${transaction._id}`}
                    className="text-blue-500 hover:text-blue-700"
                    aria-label="Editar transacción"
                  >
                    <FaEdit />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(transaction._id)}
                    className="text-red-500 hover:text-red-700"
                    aria-label="Eliminar transacción"
                  >
                    <FaTrash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-between items-center mt-4">
        <button
          type="button"
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage <= 1}
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-sm text-gray-600">
          Página {currentPage} de {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((prev) => (prev < totalPages ? prev + 1 : prev))}
          disabled={currentPage >= totalPages}
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default TransactionList;
