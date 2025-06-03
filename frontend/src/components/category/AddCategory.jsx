import React, { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FaWallet } from "react-icons/fa";
import { SiDatabricks } from "react-icons/si";
import EmojiPicker from "emoji-picker-react";
import { addCategoryAPI } from "../../services/category/categoryService";
import AlertMessage from "../Alert/AlertMessage";

const validationSchema = Yup.object({
  name: Yup.string().required("Category name is required"),
  type: Yup.string().required("Category type is required").oneOf(["income", "expense"]),
  icon: Yup.string().required("Emoji icon is required"),
});

const AddCategory = () => {
  const navigate = useNavigate();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: addCategoryAPI,
    mutationKey: ["add-category"],
  });

  const formik = useFormik({
    initialValues: {
      type: "",
      name: "",
      icon: "",
    },
    validationSchema,
    onSubmit: (values) => {
      mutateAsync(values)
        .then(() => console.log("Category added"))
        .catch((e) => console.log(e));
    },
  });

  // Redirigir luego de éxito
  if (isSuccess) {
    setTimeout(() => navigate("/categories"), 1000);
  }

  return (
    <form
      onSubmit={formik.handleSubmit}
      className="max-w-lg mx-auto my-10 bg-white p-6 rounded-lg shadow-lg space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-800">Add New Category</h2>
        <p className="text-gray-600">Fill in the details below.</p>
      </div>

      {isError && (
        <AlertMessage type="error" message={error?.response?.data?.message || "Something went wrong"} />
      )}
      {isSuccess && <AlertMessage type="success" message="Category added successfully, redirecting..." />}

      {/* Type */}
      <div className="space-y-2">
        <label htmlFor="type" className="flex gap-2 items-center text-gray-700 font-medium">
          <FaWallet className="text-blue-500" />
          <span>Type</span>
        </label>
        <select
          {...formik.getFieldProps("type")}
          id="type"
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="">Select transaction type</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label htmlFor="name" className="text-gray-700 font-medium">
          <SiDatabricks className="inline mr-2 text-blue-500" />
          Name
        </label>
        <input
          type="text"
          {...formik.getFieldProps("name")}
          id="name"
          placeholder="Category name"
          className="w-full p-2 border border-gray-300 rounded-md"
        />
      </div>

      {/* Emoji Picker */}
      <div className="space-y-2">
        <label className="text-gray-700 font-medium">Emoji Icon</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="px-3 py-1 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition"
          >
            {formik.values.icon ? formik.values.icon : "Select Emoji"}
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
        className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Add Category
      </button>
    </form>
  );
};

export default AddCategory;
