import { axiosInstance } from "../../lib/axios";

//! Add Category
export const addCategoryAPI = async ({ name, type }) => {
  const response = await axiosInstance.post("/categories/create", {
    name,
    type,
  });
  return response.data;
};

//! Update Category
export const updateCategoryAPI = async ({ name, type, icon, id }) => {
  const response = await axiosInstance.put(`/categories/update/${id}`, {
    name,
    type,
    icon,
  });
  return response.data;
};

//! Delete Category
export const deleteCategoryAPI = async (id) => {
  const response = await axiosInstance.delete(`/categories/delete/${id}`);
  return response.data;
};

//! List Categories
export const listCategoriesAPI = async () => {
  const response = await axiosInstance.get("/categories/lists");
  return response.data;
};

//! Get One Category
export const getCategoryByIdAPI = async (id) => {
  const response = await axiosInstance.get(`/categories/${id}`);
  return response.data;
};
