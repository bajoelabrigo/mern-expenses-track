import { axiosInstance } from "../../lib/axios";

//! Crear categoría
export const addCategoryAPI = async ({ name, type, icon, incomeKind }) => {
  const response = await axiosInstance.post("/categories/create", {
    name,
    type,
    icon,
    incomeKind,
  });
  return response.data;
};

//! Actualizar categoría
export const updateCategoryAPI = async ({ name, type, icon, incomeKind, id }) => {
  const response = await axiosInstance.put(`/categories/update/${id}`, {
    name,
    type,
    icon,
    incomeKind,
  });
  return response.data;
};

//! Eliminar categoría
export const deleteCategoryAPI = async (id) => {
  const response = await axiosInstance.delete(`/categories/delete/${id}`);
  return response.data;
};

//! Listar categorías del usuario
export const listCategoriesAPI = async () => {
  const response = await axiosInstance.get("/categories/lists");
  return response.data;
};

//! Obtener una categoría por id
export const getCategoryByIdAPI = async (id) => {
  const response = await axiosInstance.get(`/categories/${id}`);
  return response.data;
};

//! Pone las categorías de fábrica que le falten a este espacio (las mismas con
//! las que arranca uno nuevo). Devuelve { added }.
export const addDefaultCategoriesAPI = async () => {
  const response = await axiosInstance.post("/categories/defaults");
  return response.data;
};
