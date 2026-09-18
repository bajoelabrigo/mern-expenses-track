const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const validateObjectId = require("../middlewares/validateObjectId");
const categoryController = require("../controllers/categoryController");

const categoryRouter = express.Router();

//! Todas las rutas de categorías requieren sesión
categoryRouter.use(isAuthenticated);

categoryRouter.post("/create", categoryController.create);
categoryRouter.get("/lists", categoryController.lists);
categoryRouter.put("/update/:id", validateObjectId(), categoryController.update);
categoryRouter.delete(
  "/delete/:id",
  validateObjectId(),
  categoryController.delete
);
//! Ruta con parámetro al final para no capturar /lists ni /create
categoryRouter.get("/:id", validateObjectId(), categoryController.getOne);

module.exports = categoryRouter;
