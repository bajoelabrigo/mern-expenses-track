const asyncHandler = require("express-async-handler");
const User = require("../model/User");
const Transaction = require("../model/Transaccion");
const Category = require("../model/Category");

//! ✅ a) Ver lista de usuarios
exports.getAllUsers = asyncHandler(async (req, res) => {
  // 🔍 Buscar todos los usuarios, excluyendo el campo "password"
  const users = await User.find().select("-password");

  // 📤 Enviar la lista al frontend
  res.json(users);
});

//! ✅ b) Acceder al dashboard completo de un usuario
exports.getUserDashboard = asyncHandler(async (req, res) => {
  const userId = req.params.id; // 🔽 ID del usuario solicitado

  // 🔍 Obtener sus transacciones
  const transactions = await Transaction.find({ user: userId });

  // 🔍 Obtener sus categorías
  const categories = await Category.find({ user: userId });

  // 📤 Enviar ambas listas juntas
  res.json({ transactions, categories });
});

//! ✅ c) Editar una categoría de otro usuario
exports.updateUserCategory = asyncHandler(async (req, res) => {
  const { name, type, icon } = req.body;
  const { categoryId } = req.params;

  // 🔍 Buscar la categoría por su ID
  const category = await Category.findById(categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  // 📝 Actualizar los campos si se proporcionan
  if (name) category.name = name.toLowerCase();
  if (type) category.type = type;
  if (icon) category.icon = icon;

  // 💾 Guardar cambios
  const updatedCategory = await category.save();

  // 🔄 Si cambió el nombre, actualizar también las transacciones relacionadas
  const oldName = category.name;
  if (oldName !== updatedCategory.name) {
    await Transaction.updateMany(
      { user: category.user, category: oldName },
      { $set: { category: updatedCategory.name } }
    );
  }

  // 📤 Enviar la categoría actualizada
  res.json(updatedCategory);
});

//! ✅ d) Eliminar categoría de otro usuario
exports.deleteUserCategory = asyncHandler(async (req, res) => {
  // 🔍 Buscar la categoría por ID
  const category = await Category.findById(req.params.categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  // 🔁 Establecer categoría por defecto
  const defaultCategory = "Uncategorized";

  // 🔄 Actualizar las transacciones asociadas para que usen la categoría por defecto
  await Transaction.updateMany(
    { user: category.user, category: category.name },
    { $set: { category: defaultCategory } }
  );

  // ❌ Eliminar la categoría
  await category.deleteOne();

  // 📤 Confirmar eliminación
  res.json({ message: "Category deleted and transactions updated" });
});

//! ✅ e) Editar transacción de otro usuario
exports.updateUserTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, category, amount, date, description } = req.body;

  // 🔍 Buscar la transacción por ID
  const transaction = await Transaction.findById(id);
  if (!transaction) {
    return res.status(404).json({ message: "Transaction not found" });
  }

  // 📝 Actualizar campos solo si se envían
  transaction.type = type ?? transaction.type;
  transaction.category = category ?? transaction.category;
  transaction.amount = amount ?? transaction.amount;
  transaction.date = date ?? transaction.date;
  transaction.description = description ?? transaction.description;

  // 💾 Guardar los cambios
  const updated = await transaction.save();

  // 📤 Enviar la transacción actualizada
  res.json(updated);
});

//! ✅ f) Eliminar transacción de otro usuario
exports.deleteUserTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 🔍 Buscar transacción por ID
  const transaction = await Transaction.findById(id);
  if (!transaction) {
    return res.status(404).json({ message: "Transaction not found" });
  }

  // ❌ Eliminarla
  await transaction.deleteOne();

  // 📤 Confirmar al frontend
  res.json({ message: "Transaction deleted" });
});
