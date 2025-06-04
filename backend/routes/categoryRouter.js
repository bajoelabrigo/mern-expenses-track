const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const categoryController = require("../controllers/categoryController");
const categoryRouter = express.Router();

//! Create category
categoryRouter.post(
  "/api/v1/categories/create",
  isAuthenticated,
  categoryController.create
);

//! Get all categories for user
categoryRouter.get(
  "/api/v1/categories/lists",
  isAuthenticated,
  categoryController.lists
);

//! Get one category by ID
categoryRouter.get(
  "/api/v1/categories/:id",
  isAuthenticated,
  categoryController.getOne
);

//! Update category
categoryRouter.put(
  "/api/v1/categories/update/:id",
  isAuthenticated,
  categoryController.update
);

//! Delete category
categoryRouter.delete(
  "/api/v1/categories/delete/:id",
  isAuthenticated,
  categoryController.delete
);

module.exports = categoryRouter;
