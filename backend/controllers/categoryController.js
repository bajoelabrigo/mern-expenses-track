const asyncHandler = require("express-async-handler");
const Category = require("../model/Category");
const Transaction = require("../model/Transaccion");
const { audit, categorySnapshot } = require("../utils/audit");

const TYPES = ["income", "expense"];
const DEFAULT_CATEGORY = "uncategorized";

//! Busca una categoría del espacio actual (nunca de otro)
const findInWorkspace = (req) =>
  Category.findOne({ _id: req.params.id, workspace: req.workspace._id });

const categoryController = {
  //! Crear categoría en el espacio actual
  create: asyncHandler(async (req, res) => {
    const { name, type, icon } = req.body;

    if (!name || !type) {
      return res
        .status(400)
        .json({ message: "El nombre y el tipo son obligatorios" });
    }

    const normalizedName = String(name).trim().toLowerCase();
    const normalizedType = String(type).trim().toLowerCase();

    if (!normalizedName) {
      return res
        .status(400)
        .json({ message: "El nombre de la categoría no puede estar vacío" });
    }

    if (!TYPES.includes(normalizedType)) {
      return res
        .status(400)
        .json({ message: `Tipo de categoría inválido: '${type}'` });
    }

    const categoryExists = await Category.findOne({
      name: normalizedName,
      workspace: req.workspace._id,
    });

    if (categoryExists) {
      return res.status(409).json({
        message: `La categoría '${categoryExists.name}' ya existe en este espacio`,
      });
    }

    const category = await Category.create({
      name: normalizedName,
      workspace: req.workspace._id,
      type: normalizedType,
      icon: icon || "📁",
    });

    await audit(req, {
      action: "category.create",
      entity: "category",
      entityId: category._id,
      after: categorySnapshot(category),
    });

    res.status(201).json(category);
  }),

  //! Listar las categorías del espacio actual
  lists: asyncHandler(async (req, res) => {
    const categories = await Category.find({ workspace: req.workspace._id }).sort({
      name: 1,
    });

    res.status(200).json(categories);
  }),

  //! Actualizar. Si cambia el nombre, arrastra los movimientos del espacio.
  update: asyncHandler(async (req, res) => {
    const { type, name, icon } = req.body;

    const category = await findInWorkspace(req);
    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    //! Se guarda ANTES de mutar el documento
    const oldName = category.name;
    const before = categorySnapshot(category);

    if (name) {
      const normalizedName = String(name).trim().toLowerCase();

      if (!normalizedName) {
        return res
          .status(400)
          .json({ message: "El nombre de la categoría no puede estar vacío" });
      }

      const duplicate = await Category.findOne({
        name: normalizedName,
        workspace: req.workspace._id,
        _id: { $ne: category._id },
      });

      if (duplicate) {
        return res
          .status(409)
          .json({ message: "Ya existe una categoría con ese nombre" });
      }

      category.name = normalizedName;
    }

    if (type) {
      const normalizedType = String(type).trim().toLowerCase();
      if (!TYPES.includes(normalizedType)) {
        return res.status(400).json({ message: "Tipo de categoría inválido" });
      }
      category.type = normalizedType;
    }

    if (icon) category.icon = icon;

    const updatedCategory = await category.save();

    if (oldName !== updatedCategory.name) {
      await Transaction.updateMany(
        { workspace: req.workspace._id, category: oldName },
        { $set: { category: updatedCategory.name } }
      );
    }

    await audit(req, {
      action: "category.update",
      entity: "category",
      entityId: category._id,
      before,
      after: categorySnapshot(updatedCategory),
    });

    res.status(200).json(updatedCategory);
  }),

  //! Eliminar. Los movimientos pasan a "uncategorized".
  delete: asyncHandler(async (req, res) => {
    const category = await findInWorkspace(req);
    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    await Transaction.updateMany(
      { workspace: req.workspace._id, category: category.name },
      { $set: { category: DEFAULT_CATEGORY } }
    );

    await category.deleteOne();

    await audit(req, {
      action: "category.delete",
      entity: "category",
      entityId: category._id,
      before: categorySnapshot(category),
    });

    res.status(200).json({
      message: `Categoría '${category.name}' eliminada y transacciones actualizadas`,
    });
  }),

  //! Obtener una categoría del espacio actual
  getOne: asyncHandler(async (req, res) => {
    const category = await findInWorkspace(req);

    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    res.status(200).json(category);
  }),
};

module.exports = categoryController;
