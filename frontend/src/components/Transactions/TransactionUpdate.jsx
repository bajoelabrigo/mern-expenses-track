import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FaDollarSign,
  FaCalendarAlt,
  FaRegCommentDots,
  FaWallet,
} from "react-icons/fa";
import { listCategoriesAPI } from "../../services/category/categoryService";
import {
  fetchTransactionByIdAPI,
  updateTransactionAPI,
} from "../../services/transactions/transactionService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";

const validationSchema = Yup.object({
  type: Yup.string()
    .required("El tipo es obligatorio")
    .oneOf(["income", "expense"], "Tipo inválido"),
  amount: Yup.number()
    .typeError("El monto debe ser un número")
    .required("El monto es obligatorio")
    .positive("El monto debe ser positivo"),
  category: Yup.string().required("La categoría es obligatoria"),
  date: Yup.date()
    .typeError("Fecha inválida")
    .required("La fecha es obligatoria"),
  description: Yup.string(),
});

const TransactionUpdate = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  //! Datos de la transacción a editar (con React Query, no con un efecto manual)
  const {
    data: transaction,
    isLoading,
    isError: isLoadError,
    error: loadError,
  } = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => fetchTransactionByIdAPI(id),
    enabled: Boolean(id),
  });

  const {
    data: categories = [],
    isError: isCategoriesError,
    error: categoriesError,
  } = useQuery({
    queryFn: listCategoriesAPI,
    queryKey: ["list-categories"],
  });

  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: updateTransactionAPI,
    mutationKey: ["update-transaction"],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction", id] });
    },
  });

  const formik = useFormik({
    initialValues: {
      type: transaction?.type || "",
      amount: transaction?.amount ?? "",
      category: transaction?.category || "",
      date: transaction?.date?.slice(0, 10) || "",
      description: transaction?.description || "",
    },
    enableReinitialize: true,
    validationSchema,
    onSubmit: async (values) => {
      try {
        await mutateAsync({
          ...values,
          //! Mediodía local evita el desfase de zona horaria
          date: new Date(`${values.date}T12:00:00`).toISOString(),
          id,
        });
      } catch {
        // el mensaje se muestra con AlertMessage
      }
    },
  });

  useEffect(() => {
    if (!isSuccess) return undefined;

    const timeout = setTimeout(() => navigate("/dashboard"), 1000);
    return () => clearTimeout(timeout);
  }, [isSuccess, navigate]);

  return (
    <div className="fixed left-0 top-0 z-50 flex h-full min-h-screen w-full items-center justify-center bg-black/70 px-4 py-5 overflow-y-auto">
      <div className="md:px-16 w-full max-w-2xl rounded-lg bg-white md:py-8 py-12">
        <form
          onSubmit={formik.handleSubmit}
          className="max-w-lg mx-auto my-10 bg-white p-6 rounded-lg shadow-lg space-y-6"
        >
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-800">
              Actualizar transacción
            </h2>
            <p className="text-gray-600">
              Llene los campos que desea actualizar.
            </p>
          </div>

          {isLoading && <AlertMessage type="loading" message="Cargando..." />}
          {isLoadError && (
            <AlertMessage type="error" message={getErrorMessage(loadError)} />
          )}
          {isCategoriesError && (
            <AlertMessage
              type="error"
              message={getErrorMessage(categoriesError)}
            />
          )}
          {isError && (
            <AlertMessage type="error" message={getErrorMessage(error)} />
          )}
          {isSuccess && (
            <AlertMessage
              type="success"
              message="Transacción actualizada correctamente"
            />
          )}

          <div className="space-y-2">
            <label
              htmlFor="type"
              className="flex gap-2 items-center text-gray-700 font-medium"
            >
              <FaWallet className="text-blue-500" />
              <span>Tipo</span>
            </label>
            <select
              {...formik.getFieldProps("type")}
              id="type"
              className="block w-full p-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:border-blue-500"
            >
              <option value="">Selecciona el tipo</option>
              <option value="income">Ingreso</option>
              <option value="expense">Gasto</option>
            </select>
            {formik.touched.type && formik.errors.type && (
              <p className="text-red-500 text-xs">{formik.errors.type}</p>
            )}
          </div>

          <div className="flex flex-col space-y-1">
            <label htmlFor="amount" className="text-gray-700 font-medium">
              <FaDollarSign className="inline mr-2 text-blue-500" />
              Cantidad
            </label>
            <input
              type="number"
              step="0.01"
              {...formik.getFieldProps("amount")}
              id="amount"
              placeholder="Cantidad"
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500"
            />
            {formik.touched.amount && formik.errors.amount && (
              <p className="text-red-500 text-xs italic">
                {formik.errors.amount}
              </p>
            )}
          </div>

          <div className="flex flex-col space-y-1">
            <label htmlFor="category" className="text-gray-700 font-medium">
              <FaRegCommentDots className="inline mr-2 text-blue-500" />
              Categoría
            </label>
            <select
              {...formik.getFieldProps("category")}
              id="category"
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500"
            >
              <option value="">Seleccione la categoría</option>
              {categories.map((category) => (
                <option key={category._id} value={category.name}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
            {formik.touched.category && formik.errors.category && (
              <p className="text-red-500 text-xs italic">
                {formik.errors.category}
              </p>
            )}
          </div>

          <div className="flex flex-col space-y-1">
            <label htmlFor="date" className="text-gray-700 font-medium">
              <FaCalendarAlt className="inline mr-2 text-blue-500" />
              Fecha
            </label>
            <input
              type="date"
              {...formik.getFieldProps("date")}
              id="date"
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500"
            />
            {formik.touched.date && formik.errors.date && (
              <p className="text-red-500 text-xs italic">{formik.errors.date}</p>
            )}
          </div>

          <div className="flex flex-col space-y-1">
            <label htmlFor="description" className="text-gray-700 font-medium">
              <FaRegCommentDots className="inline mr-2 text-blue-500" />
              Descripción (opcional)
            </label>
            <textarea
              {...formik.getFieldProps("description")}
              id="description"
              placeholder="Descripción"
              rows="3"
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-between gap-8">
            <button
              type="submit"
              disabled={isPending}
              className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none transition-colors duration-200 disabled:opacity-60"
            >
              {isPending ? "Actualizando..." : "Actualizar transacción"}
            </button>
            <Link
              to="/dashboard"
              className="mt-4 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-10 rounded focus:outline-none transition-colors duration-200"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionUpdate;
