const express = require("express");
const isAuthenticated = require("../middlewares/isAuth");
const validateObjectId = require("../middlewares/validateObjectId");
const { withWorkspace, requirePermission } = require("../middlewares/workspace");
const categoryController = require("../controllers/categoryController");

const categoryRouter = express.Router();

//! Todas las rutas exigen sesión y trabajan sobre el espacio actual
categoryRouter.use(isAuthenticated, withWorkspace);

const read = requirePermission("tx:read");
const write = requirePermission("category:write");

categoryRouter.post("/create", write, categoryController.create);
categoryRouter.post("/church-defaults", write, categoryController.addChurchDefaults);
categoryRouter.get("/lists", read, categoryController.lists);
categoryRouter.put(
  "/update/:id",
  validateObjectId(),
  write,
  categoryController.update
);
categoryRouter.delete(
  "/delete/:id",
  validateObjectId(),
  write,
  categoryController.delete
);
//! Ruta con parámetro al final para no capturar /lists ni /create
categoryRouter.get("/:id", validateObjectId(), read, categoryController.getOne);

module.exports = categoryRouter;
