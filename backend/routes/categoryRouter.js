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
//! Las categorías de fábrica que falten (las mismas con las que arranca un
//! espacio nuevo). El nombre viejo sigue en pie para las apps que ya estaban
//! abiertas en un teléfono: se actualizan solas, pero hasta entonces piden esta.
categoryRouter.post("/defaults", write, categoryController.addDefaults);
categoryRouter.post("/church-defaults", write, categoryController.addDefaults);
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
