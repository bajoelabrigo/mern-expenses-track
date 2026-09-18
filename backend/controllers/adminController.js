const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const User = require("../model/User");
const Transaction = require("../model/Transaccion");
const Category = require("../model/Category");
const { parseStartDate, parseEndDate } = require("../utils/dates");

const TYPES = ["income", "expense"];
const DEFAULT_CATEGORY = "uncategorized";
const MAX_LIMIT = 200;

//! a) Listado de usuarios (sin contraseñas)
exports.getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
});

//! b) Dashboard completo de un usuario (transacciones paginadas + totales)
exports.getUserDashboard = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const { page = 1, limit = 50, startDate, endDate } = req.query;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  const filters = { user: userId };

  const parsedStart = parseStartDate(startDate);
  if (parsedStart === undefined) {
    return res.status(400).json({ message: "Fecha de inicio inválida" });
  }
  const parsedEnd = parseEndDate(endDate);
  if (parsedEnd === undefined) {
    return res.status(400).json({ message: "Fecha de fin inválida" });
  }
  if (parsedStart) filters.date = { ...filters.date, $gte: parsedStart };
  if (parsedEnd) filters.date = { ...filters.date, $lte: parsedEnd };

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(limit, 10) || 50)
  );

  const [total, transactions, categories, totals] = await Promise.all([
    Transaction.countDocuments(filters),
    Transaction.find(filters)
      .sort({ date: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit),
    Category.find({ user: userId }).sort({ name: 1 }),
    Transaction.aggregate([
      { $match: { ...filters, user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          income: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          expense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
        },
      },
    ]),
  ]);

  const { income = 0, expense = 0 } = totals[0] || {};

  res.json({
    user,
    transactions,
    categories,
    totals: { income, expense, balance: income - expense },
    total,
    currentPage: parsedPage,
    totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
    limit: parsedLimit,
  });
});

//! c) Editar categoría de otro usuario
exports.updateUserCategory = asyncHandler(async (req, res) => {
  const { name, type, icon } = req.body;

  const category = await Category.findById(req.params.categoryId);
  if (!category) {
    return res.status(404).json({ message: "Categoría no encontrada" });
  }

  //! Se guarda ANTES de mutar el documento: de lo contrario oldName y el nombre
  //! nuevo son siempre iguales y las transacciones nunca se actualizan.
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

  res.json(updatedCategory);
});

//! d) Eliminar categoría de otro usuario
exports.deleteUserCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.categoryId);
  if (!category) {
    return res.status(404).json({ message: "Categoría no encontrada" });
  }

  await Transaction.updateMany(
    { user: category.user, category: category.name },
    { $set: { category: DEFAULT_CATEGORY } }
  );

  await category.deleteOne();

  res.json({ message: "Categoría eliminada y transacciones actualizadas" });
});

//! e) Editar transacción de otro usuario
exports.updateUserTransaction = asyncHandler(async (req, res) => {
  const { type, category, amount, date, description, icon } = req.body;

  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) {
    return res.status(404).json({ message: "Transacción no encontrada" });
  }

  if (type !== undefined) {
    if (!TYPES.includes(type)) {
      return res.status(400).json({ message: "Tipo de transacción inválido" });
    }
    transaction.type = type;
  }

  if (amount !== undefined) {
    const parsedAmount = parseFloat(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res
        .status(400)
        .json({ message: "El monto debe ser un número positivo" });
    }
    transaction.amount = parsedAmount;
  }

  if (date !== undefined) {
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Fecha inválida" });
    }
    transaction.date = parsedDate;
  }

  if (category !== undefined) {
    transaction.category = String(category).trim().toLowerCase();
  }
  if (description !== undefined) transaction.description = description;
  if (icon !== undefined) transaction.icon = icon;

  const updated = await transaction.save();

  res.json(updated);
});

//! f) Eliminar transacción de otro usuario
exports.deleteUserTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) {
    return res.status(404).json({ message: "Transacción no encontrada" });
  }

  await transaction.deleteOne();

  res.json({ message: "Transacción eliminada" });
});
