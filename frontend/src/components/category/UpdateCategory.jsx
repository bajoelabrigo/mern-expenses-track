import React, { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { FaWallet } from "react-icons/fa";
import { SiDatabricks } from "react-icons/si";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  updateCategoryAPI,
  getCategoryByIdAPI,
} from "../../services/category/categoryService";
import AlertMessage from "../Alert/AlertMessage";
import EmojiPicker from "emoji-picker-react";

const validationSchema = Yup.object({
  name: Yup.string(), // opcional
  type: Yup.string().oneOf(["income", "expense"]), // opcional
  icon: Yup.string(), // opcional
});

const UpdateCategory = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: updateCategoryAPI,
    mutationKey: ["update-category"],
  });

  const [initialData, setInitialData] = useState({
    name: "",
    type: "",
    icon: "",
  });

  const formik = useFormik({
    initialValues: initialData,
    enableReinitialize: true,
    validationSchema,
    onSubmit: (values) => {
      mutateAsync({ ...values, id })
        .then(() => console.log("Category updated"))
        .catch((e) => console.log(e));
    },
  });

  //! ⬇️ Cargar la categorias existente al montar
  useEffect(() => {
    const loadCategory = async () => {
      try {
        const category = await getCategoryByIdAPI(id);
        formik.setValues({
          type: category.type || "",
          name: category.name || "",
          icon: category.icon || "",
        });
      } catch (e) {
        console.error("Error fetching categories:", e);
      }
    };

    if (id) {
      loadCategory();
    }
  }, [id]);

  useEffect(() => {
    if (isSuccess) {
      const timeout = setTimeout(() => navigate("/categories"), 1000);
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
          Actualizar Categoria
        </h2>
        <p className="text-gray-600">Complete los datos a continuación.</p>
      </div>

      {isError && (
        <AlertMessage
          type="error"
          message={
            error?.response?.data?.message ||
            "Algo pasó, por favor inténtalo de nuevo más tarde"
          }
        />
      )}
      {isSuccess && (
        <AlertMessage
          type="success"
          message="Categoría actualizada correctamente. Redirigiendo..."
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
          className="w-full p-2 mt-1 border border-gray-300 rounded-md"
        >
          <option value="">Seleccione el tipo de transacción</option>
          <option value="income">Ingreso</option>
          <option value="expense">Gasto</option>
        </select>
      </div>

      {/* Name */}
      <div className="flex flex-col">
        <label htmlFor="name" className="text-gray-700 font-medium">
          <SiDatabricks className="inline mr-2 text-blue-500" /> Nombre
        </label>
        <input
          type="text"
          {...formik.getFieldProps("name")}
          placeholder="Nombre de Categoria"
          id="name"
          className="w-full mt-1 border border-gray-300 rounded-md py-2 px-3"
        />
      </div>

      {/* Emoji Picker */}
      <div className="space-y-2">
        <label className="text-gray-700 font-medium">Icono de Emoji</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="px-3 py-1 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition"
          >
            {formik.values.icon ? formik.values.icon : "Seleccionar Emoji"}
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
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        {isPending ? "Actualizando..." : "Actualizar Categoria"}
      </button>
    </form>
  );
};

export default UpdateCategory;
