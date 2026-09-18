import { useEffect } from "react";
import { useFormik } from "formik";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FaDollarSign,
  FaCalendarAlt,
  FaRegCommentDots,
  FaWallet,
} from "react-icons/fa";
import { listCategoriesAPI } from "../../services/category/categoryService";
import { addTransactionAPI } from "../../services/transactions/transactionService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";

const validationSchema = Yup.object({
  type: Yup.string()
    .required("El tipo de transacción es obligatorio")
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
  recurrent: Yup.boolean(),
  recurrenceType: Yup.string().when("recurrent", {
    is: true,
    then: (schema) =>
      schema
        .required("El tipo de recurrencia es obligatorio")
        .oneOf(["daily", "weekly", "monthly", "yearly"], "Recurrencia inválida"),
  }),
  recurrenceCount: Yup.number().when("recurrent", {
    is: true,
    then: (schema) =>
      schema
        .typeError("Debe ser un número")
        .required("Indica cuántas veces se repite")
        .min(1, "Debe ser al menos 1")
        .max(365, "Demasiadas repeticiones (máximo 365)"),
  }),
});

const TransactionForm = () => {
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: addTransactionAPI,
    mutationKey: ["add-transaction"],
    onSuccess: () => {
      //! Refresca listado, gráficos y balances
      queryClient.invalidateQueries({ queryKey: ["list-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  //! Categorías para el desplegable
  const {
    data: categories = [],
    isError: isCategoriesError,
    error: categoriesError,
  } = useQuery({
    queryFn: listCategoriesAPI,
    queryKey: ["list-categories"],
  });

  const formik = useFormik({
    initialValues: {
      type: "",
      amount: "",
      category: "",
      date: "",
      description: "",
      recurrent: false,
      recurrenceType: "",
      recurrenceCount: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      const adjustedValues = {
        ...values,
        //! Mediodía local evita el desfase de zona horaria al guardar la fecha
        date: new Date(`${values.date}T12:00:00`).toISOString(),
        recurrenceCount: values.recurrent ? Number(values.recurrenceCount) : 0,
      };

      try {
        await mutateAsync(adjustedValues);
      } catch {
        // el mensaje se muestra con AlertMessage
      }
    },
  });

  useEffect(() => {
    if (isSuccess) {
      const timeout = setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isSuccess, navigate]);

  return (
    <form
      onSubmit={formik.handleSubmit}
      className="max-w-lg mx-auto my-10 bg-white p-6 rounded-lg shadow-lg space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-800">
          Detalles de la transacción
        </h2>
        <p className="text-gray-600">Llena todos los campos a continuación.</p>
      </div>

      {isPending && <AlertMessage type="loading" message="Guardando..." />}
      {isCategoriesError && (
        <AlertMessage type="error" message={getErrorMessage(categoriesError)} />
      )}
      {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
      {isSuccess && (
        <AlertMessage
          type="success"
          message="Transacción agregada exitosamente"
        />
      )}

      {/* Type */}
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
          className="block w-full p-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
        >
          <option value="">Seleccione el tipo de transacción</option>
          <option value="income">Ingreso</option>
          <option value="expense">Gasto</option>
        </select>
        {formik.touched.type && formik.errors.type && (
          <p className="text-red-500 text-xs">{formik.errors.type}</p>
        )}
      </div>

      {/* Amount */}
      <div className="flex flex-col space-y-1">
        <label htmlFor="amount" className="text-gray-700 font-medium">
          <FaDollarSign className="inline mr-2 text-blue-500" />
          Cantidad
        </label>
        <input
          type="number"
          {...formik.getFieldProps("amount")}
          id="amount"
          placeholder="Cantidad"
          className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
        />
        {formik.touched.amount && formik.errors.amount && (
          <p className="text-red-500 text-xs italic">{formik.errors.amount}</p>
        )}
      </div>

      {/* Category */}
      <div className="flex flex-col space-y-1">
        <label htmlFor="category" className="text-gray-700 font-medium">
          <FaRegCommentDots className="inline mr-2 text-blue-500" />
          Categoria
        </label>
        <select
          {...formik.getFieldProps("category")}
          id="category"
          className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
        >
          <option value="">Seleccione una categoría</option>
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

      {/* Date */}
      <div className="flex flex-col space-y-1">
        <label htmlFor="date" className="text-gray-700 font-medium">
          <FaCalendarAlt className="inline mr-2 text-blue-500" />
          Fecha
        </label>
        <input
          type="date"
          {...formik.getFieldProps("date")}
          id="date"
          className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
        />
        {formik.touched.date && formik.errors.date && (
          <p className="text-red-500 text-xs italic">{formik.errors.date}</p>
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col space-y-1">
        <label htmlFor="description" className="text-gray-700 font-medium">
          <FaRegCommentDots className="inline mr-2 text-blue-500" />
          Descripción (Opcional)
        </label>
        <textarea
          {...formik.getFieldProps("description")}
          id="description"
          placeholder="Descripción"
          rows="3"
          className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
        ></textarea>
        {formik.touched.description && formik.errors.description && (
          <p className="text-red-500 text-xs italic">
            {formik.errors.description}
          </p>
        )}
      </div>

      {/* Recurrent checkbox */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="recurrent"
          name="recurrent"
          checked={formik.values.recurrent}
          onChange={formik.handleChange}
          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="recurrent" className="text-gray-700 font-medium">
          Transacción repetida (recurrente)
        </label>
      </div>

      {/* Conditional recurrence fields */}
      {formik.values.recurrent && (
        <div className="space-y-3">
          {/* Recurrence Type */}
          <div>
            <label
              htmlFor="recurrenceType"
              className="text-gray-700 font-medium"
            >
              Tipo de recurrencia
            </label>
            <select
              {...formik.getFieldProps("recurrenceType")}
              id="recurrenceType"
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 mt-1"
            >
              <option value="">Seleccionar recurrencia</option>
              <option value="daily">Diariamente</option>
              <option value="weekly">Semanalmente</option>
              <option value="monthly">Mensualmente</option>
              <option value="yearly">Anualmente</option>
            </select>
            {formik.touched.recurrenceType && formik.errors.recurrenceType && (
              <p className="text-red-500 text-xs italic">
                {formik.errors.recurrenceType}
              </p>
            )}
          </div>

          {/* Recurrence Count */}
          <div>
            <label
              htmlFor="recurrenceCount"
              className="text-gray-700 font-medium"
            >
              Recuento de repeticiones
            </label>
            <input
              type="number"
              {...formik.getFieldProps("recurrenceCount")}
              id="recurrenceCount"
              placeholder="Ejemplo: 6"
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
            />
            {formik.touched.recurrenceCount &&
              formik.errors.recurrenceCount && (
                <p className="text-red-500 text-xs italic">
                  {formik.errors.recurrenceCount}
                </p>
              )}
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none transition-colors duration-200 disabled:opacity-60"
      >
        {isPending ? "Guardando..." : "Enviar transacción"}
      </button>
    </form>
  );
};

export default TransactionForm;
