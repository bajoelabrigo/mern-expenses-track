const asyncHandler = require("express-async-handler");
const User = require("../model/User");
const Transaction = require("../model/Transaccion");
const Category = require("../model/Category");

// ✅ a) Ver lista de usuarios
exports.getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
});

// ✅ b) Acceder al dashboard completo de un usuario
exports.getUserDashboard = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  const transactions = await Transaction.find({ user: userId });
  const categories = await Category.find({ user: userId });

  res.json({ transactions, categories });
});

// ✅ c) Editar una categoría de otro usuario
exports.updateUserCategory = asyncHandler(async (req, res) => {
  const { name, type, icon } = req.body;
  const { categoryId } = req.params;

  const category = await Category.findById(categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  if (name) category.name = name.toLowerCase();
  if (type) category.type = type;
  if (icon) category.icon = icon;

  const updatedCategory = await category.save();

  // Actualizar transacciones asociadas si cambió el nombre
  const oldName = category.name;
  if (oldName !== updatedCategory.name) {
    await Transaction.updateMany(
      { user: category.user, category: oldName },
      { $set: { category: updatedCategory.name } }
    );
  }

  res.json(updatedCategory);
});

// ✅ d) Eliminar categoría de otro usuario
exports.deleteUserCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  const defaultCategory = "Uncategorized";

  // Actualizar transacciones relacionadas
  await Transaction.updateMany(
    { user: category.user, category: category.name },
    { $set: { category: defaultCategory } }
  );

  await category.deleteOne();
  res.json({ message: "Category deleted and transactions updated" });
});

// ✅ e) Editar transacción de otro usuario
exports.updateUserTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, category, amount, date, description } = req.body;

  const transaction = await Transaction.findById(id);
  if (!transaction) {
    return res.status(404).json({ message: "Transaction not found" });
  }

  transaction.type = type ?? transaction.type;
  transaction.category = category ?? transaction.category;
  transaction.amount = amount ?? transaction.amount;
  transaction.date = date ?? transaction.date;
  transaction.description = description ?? transaction.description;

  const updated = await transaction.save();
  res.json(updated);
});

// ✅ f) Eliminar transacción de otro usuario
exports.deleteUserTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const transaction = await Transaction.findById(id);
  if (!transaction) {
    return res.status(404).json({ message: "Transaction not found" });
  }

  await transaction.deleteOne();
  res.json({ message: "Transaction deleted" });
});
