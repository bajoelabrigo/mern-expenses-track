import { FaTrash, FaEdit } from "react-icons/fa";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  deleteCategoryAPI,
  listCategoriesAPI,
} from "../../services/category/categoryService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";

const CategoriesList = () => {
  const queryClient = useQueryClient();

  const {
    data: categories = [],
    isError,
    isLoading,
    error,
  } = useQuery({
    queryFn: listCategoriesAPI,
    queryKey: ["list-categories"],
  });

  const {
    mutateAsync,
    isError: isDeleteError,
    error: deleteError,
  } = useMutation({
    mutationFn: deleteCategoryAPI,
    mutationKey: ["delete-category"],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-categories"] });
      queryClient.invalidateQueries({ queryKey: ["list-transactions"] });
    },
  });

  const handleDelete = async (id, nombre) => {
    //! Borrar una categoría reasigna sus transacciones: conviene confirmar
    const confirmado = window.confirm(
      `¿Eliminar la categoría "${nombre}"? Sus transacciones pasarán a "uncategorized".`
    );
    if (!confirmado) return;

    try {
      await mutateAsync(id);
    } catch {
      // el mensaje se muestra con AlertMessage
    }
  };

  return (
    <div className="max-w-md mx-auto my-10 bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Categorías</h2>

      {isLoading && <AlertMessage type="loading" message="Cargando..." />}
      {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
      {isDeleteError && (
        <AlertMessage type="error" message={getErrorMessage(deleteError)} />
      )}

      {!isLoading && categories.length === 0 && (
        <p className="text-gray-500 text-sm">
          Todavía no tienes categorías.{" "}
          <Link to="/add-category" className="text-blue-600 hover:underline">
            Crea la primera
          </Link>
          .
        </p>
      )}

      <ul className="space-y-4">
        {categories.map((category) => (
          <li
            key={category._id}
            className="flex justify-between items-center bg-gray-50 p-3 rounded-md"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{category?.icon || "📁"}</span>
              <div>
                <span className="text-gray-800 font-medium capitalize">
                  {category?.name}
                </span>
                <span
                  className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    category.type === "income"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {category.type === "income" ? "Ingreso" : "Gasto"}
                </span>
              </div>
            </div>

            <div className="flex space-x-3">
              <Link
                to={`/update-category/${category._id}`}
                className="text-blue-500 hover:text-blue-700"
                aria-label={`Editar ${category.name}`}
              >
                <FaEdit />
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(category._id, category.name)}
                className="text-red-500 hover:text-red-700"
                aria-label={`Eliminar ${category.name}`}
              >
                <FaTrash />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CategoriesList;
