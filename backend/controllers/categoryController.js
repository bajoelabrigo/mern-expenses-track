const asyncHandler = require("express-async-handler");
const Category = require("../model/Category");
const Transaction = require("../model/Transaccion");

const TYPES = ["income", "expense"];
const DEFAULT_CATEGORY = "uncategorized";

//! El dueño siempre puede; el admin también (panel de administración)
const canManage = (category, user) =>
  category.user.toString() === user._id.toString() || user.role === "admin";

const categoryController = {
  //! Crear categoría para el usuario autenticado
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
      user: req.user._id,
    });

    if (categoryExists) {
      return res.status(409).json({
        message: `La categoría '${categoryExists.name}' ya existe en tu lista`,
      });
    }

    const category = await Category.create({
      name: normalizedName,
      user: req.user._id,
      type: normalizedType,
      icon: icon || "📁",
    });

    res.status(201).json(category);
  }),

  //! Listar las categorías del usuario autenticado
  lists: asyncHandler(async (req, res) => {
    const categories = await Category.find({ user: req.user._id }).sort({
      name: 1,
    });

    res.status(200).json(categories);
  }),

  //! Actualizar (dueño o admin). Si cambia el nombre, arrastra las transacciones.
  update: asyncHandler(async (req, res) => {
    const { type, name, icon } = req.body;

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    if (!canManage(category, req.user)) {
      return res
        .status(403)
        .json({ message: "No autorizado para actualizar esta categoría" });
    }

    //! Se guarda ANTES de mutar el documento
    const oldName = category.name;

    if (name) {
      const normalizedName = String(name).trim().toLowerCase();

      if (!normalizedName) {
        return res
          .status(400)
          .json({ message: "El nombre de la categoría no puede estar vacío" });
      }

      const duplicate = await Category.findOne({
        name: normalizedName,
        user: category.user,
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
        { user: category.user, category: oldName },
        { $set: { category: updatedCategory.name } }
      );
    }

    res.status(200).json(updatedCategory);
  }),

  //! Eliminar (dueño o admin). Las transacciones pasan a "uncategorized".
  delete: asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    if (!canManage(category, req.user)) {
      return res
        .status(403)
        .json({ message: "No autorizado para eliminar esta categoría" });
    }

    await Transaction.updateMany(
      { user: category.user, category: category.name },
      { $set: { category: DEFAULT_CATEGORY } }
    );

    await category.deleteOne();

    res.status(200).json({
      message: `Categoría '${category.name}' eliminada y transacciones actualizadas`,
    });
  }),

  //! Obtener una categoría (dueño o admin)
  getOne: asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    if (!canManage(category, req.user)) {
      return res
        .status(403)
        .json({ message: "No autorizado para ver esta categoría" });
    }

    res.status(200).json(category);
  }),
};

module.exports = categoryController;
