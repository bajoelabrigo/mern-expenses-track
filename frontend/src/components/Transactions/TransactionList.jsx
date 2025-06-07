import React, { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FaTrash, FaEdit } from "react-icons/fa";

//! 📦 Servicios que conectan con el backend
import {
  deleteTransactionAPI,
  listTransationsAPI,
} from "../../services/transactions/transactionService";
import { listCategoriesAPI } from "../../services/category/categoryService";
import { Link, useParams } from "react-router-dom";

const TransactionList = () => {
  const { id } = useParams(); // Obtener ID desde URL (no usado aquí)
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);

  // 🧠 Estado local para filtros
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "", // ✅ CORREGIDO AQUÍ
    type: "",
    category: "",
  });

  //! 🔄 Manejo de inputs de filtro
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  //! 📁 Obtener categorías
  const {
    data: categoryData,
    isLoading: categoryLoading,
    error: categoryErr,
  } = useQuery({
    queryFn: listCategoriesAPI,
    queryKey: ["list-categories"],
  });

  //! 📊 Obtener transacciones filtradas
  const {
    data: transactions,
    isError,
    error,
    isLoading,
    isFetched,
    refetch,
  } = useQuery({
    queryFn: () => listTransationsAPI({ ...filters, page, limit }),
    queryKey: ["list-transactions", filters, page, limit],
  });

  //! ❌ Eliminar una transacción
  const {
    mutateAsync,
    isPending,
    error: transactionError,
    isSuccess,
  } = useMutation({
    mutationFn: deleteTransactionAPI,
    mutationKey: ["delete-transaction"],
  });

  const handleDelete = (id) => {
    mutateAsync(id)
      .then(() => refetch())
      .catch((e) => console.log(e));
  };

  //! 🔎 Obtener ícono de categoría
  const getCategoryIcon = (categoryName) => {
    const matched = categoryData?.find((c) => c.name === categoryName);
    return matched?.icon || "💼"; // ícono por defecto
  };

  return (
    <div className="my-4 p-4 shadow-lg rounded-lg bg-white">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <input
          type="date"
          value={filters.startDate}
          onChange={handleFilterChange}
          name="startDate"
          className="p-2 rounded-lg border-gray-300"
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={handleFilterChange}
          name="endDate"
          className="p-2 rounded-lg border-gray-300"
        />
        {/* Selects de tipo y categoría */}
        <div className="relative">
          <select
            name="type"
            value={filters.type}
            onChange={handleFilterChange}
            className="w-full p-2 rounded-lg border-gray-300 appearance-none"
          >
            <option value="">Todos los tipos</option>
            <option value="income">Ingreso</option>
            <option value="expense">Gasto</option>
          </select>
          <ChevronDownIcon className="w-5 h-5 absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
        </div>
        <div className="relative">
          <select
            name="category"
            value={filters.category}
            onChange={handleFilterChange}
            className="w-full p-2 rounded-lg border-gray-300 appearance-none"
          >
            <option value="All">Todas las categorías</option>
            <option value="Uncategorized">Sin categorizar</option>
            {categoryData?.map((category) => (
              <option key={category._id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="w-5 h-5 absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
        </div>
      </div>

      {/*📄 Lista de transacciones renderizadas */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold mb-4 text-gray-800">
          Transacciones filtradas
        </h3>
        <ul className="list-disc pl-5 space-y-2">
          {transactions?.transactions?.map((transaction) => (
            <li
              key={transaction._id}
              className="bg-white p-3 rounded-md shadow border flex justify-between items-center"
            >
              <div>
                <span className="font-medium text-gray-600">
                  {new Date(transaction.date).toLocaleDateString()}
                </span>
                <span
                  className={`ml-2 px-2 inline-flex text-xs font-semibold rounded-full ${
                    transaction.type === "income"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {transaction.type.charAt(0).toUpperCase() +
                    transaction.type.slice(1)}
                </span>
                <span className="ml-2 text-blue-800">
                  {getCategoryIcon(transaction.category)}
                </span>
                <span className="ml-2 font-semibold text-gray-800">
                  {transaction.category} - S/.
                  {Number(transaction.amount).toFixed(2)}
                </span>
                <span className="text-sm text-gray-600 italic ml-2">
                  {transaction.description}
                </span>
              </div>
              <div className="flex space-x-3">
                <Link to={`/update-transactions/${transaction._id}`}>
                  <button className="text-blue-500 hover:text-blue-700">
                    <FaEdit />
                  </button>
                </Link>
                <button
                  onClick={() => handleDelete(transaction._id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <FaTrash />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          disabled={page === 1}
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-sm text-gray-600">Página {page}</span>
        <button
          onClick={() => setPage((prev) => prev + 1)}
          className="px-4 py-2 bg-gray-300 rounded"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default TransactionList;
