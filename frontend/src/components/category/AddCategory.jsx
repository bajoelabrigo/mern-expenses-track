import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FaWallet } from "react-icons/fa";
import { SiDatabricks } from "react-icons/si";
import EmojiPicker from "emoji-picker-react";
import { addCategoryAPI } from "../../services/category/categoryService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";

const validationSchema = Yup.object({
  name: Yup.string().required("El nombre de la categoría es obligatorio"),
  type: Yup.string()
    .required("El tipo de categoría es obligatorio")
    .oneOf(["income", "expense"], "Tipo inválido"),
  icon: Yup.string().required("Selecciona un ícono"),
});

const AddCategory = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: addCategoryAPI,
    mutationKey: ["add-category"],
    onSuccess: () => {
      //! Refresca cualquier listado de categorías en caché
      queryClient.invalidateQueries({ queryKey: ["list-categories"] });
    },
  });

  const formik = useFormik({
    initialValues: {
      type: "",
      name: "",
      icon: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        await mutateAsync(values);
      } catch {
        // el mensaje se muestra con AlertMessage
      }
    },
  });

  //! La redirección va en un efecto, no en el cuerpo del render
  useEffect(() => {
    if (!isSuccess) return undefined;

    const timeout = setTimeout(() => navigate("/categories"), 1000);
    return () => clearTimeout(timeout);
  }, [isSuccess, navigate]);

  return (
    <form
      onSubmit={formik.handleSubmit}
      className="max-w-lg mx-auto my-10 bg-white p-6 rounded-lg shadow-lg space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-800">
          Agregar nueva categoría
        </h2>
        <p className="text-gray-600">Complete los detalles a continuación.</p>
      </div>

      {isPending && <AlertMessage type="loading" message="Guardando..." />}
      {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
      {isSuccess && (
        <AlertMessage
          type="success"
          message="Categoría agregada, redirigiendo..."
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
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="">Seleccione el tipo</option>
          <option value="income">Ingreso</option>
          <option value="expense">Gasto</option>
        </select>
        {formik.touched.type && formik.errors.type && (
          <span className="text-xs text-red-500">{formik.errors.type}</span>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="name" className="text-gray-700 font-medium">
          <SiDatabricks className="inline mr-2 text-blue-500" />
          Nombre
        </label>
        <input
          type="text"
          {...formik.getFieldProps("name")}
          id="name"
          placeholder="Nombre de la categoría..."
          className="w-full p-2 border border-gray-300 rounded-md"
        />
        {formik.touched.name && formik.errors.name && (
          <span className="text-xs text-red-500">{formik.errors.name}</span>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-gray-700 font-medium">Ícono</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className="px-3 py-1 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition"
          >
            {formik.values.icon || "Seleccionar emoji"}
          </button>
          {formik.values.icon && (
            <span className="text-2xl">{formik.values.icon}</span>
          )}
        </div>
        {showEmojiPicker && (
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              formik.setFieldValue("icon", emojiData.emoji);
              setShowEmojiPicker(false);
            }}
          />
        )}
        {formik.touched.icon && formik.errors.icon && (
          <span className="text-xs text-red-500">{formik.errors.icon}</span>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-60"
      >
        Agregar categoría
      </button>
    </form>
  );
};

export default AddCategory;
