const asyncHandler = require("express-async-handler");
const Category = require("../model/Category");
const Transaction = require("../model/Transaccion");

const categoryController = {
  //! Crear una nueva categoría para el usuario autenticado
  create: asyncHandler(async (req, res) => {
    // 1️⃣ Extraer los campos del cuerpo de la solicitud
    const { name, type, icon } = req.body;

    // 2️⃣ Validar que el nombre y tipo sean obligatorios
    if (!name || !type) {
      return res
        .status(400)
        .json({ message: "El nombre y el tipo son obligatorios" });
    }

    // 3️⃣ Normalizar el nombre (evita duplicados por mayúsculas/minúsculas)
    const normalizedName = name.trim().toLowerCase();

    // 4️⃣ Validar que el tipo sea válido: solo 'income' o 'expense'
    const validTypes = ["income", "expense"];
    const normalizedType = type.trim().toLowerCase();

    if (!validTypes.includes(normalizedType)) {
      return res
        .status(400)
        .json({ message: `Tipo de categoría inválido: '${type}'` });
    }

    // 5️⃣ Verificar si ya existe una categoría con ese nombre para ese usuario
    const categoryExists = await Category.findOne({
      name: normalizedName,
      user: req.user._id,
    });

    if (categoryExists) {
      return res.status(409).json({
        message: `La categoría '${categoryExists.name}' ya existe en tu lista`,
      });
    }

    // 6️⃣ Crear y guardar la nueva categoría
    const category = await Category.create({
      name: normalizedName,
      user: req.user._id,
      type: normalizedType,
      icon: icon || "📁", // ícono por defecto si no se proporciona
    });

    // 7️⃣ Devolver la categoría creada
    res.status(201).json(category);
  }),

  //! Obtener todas las categorías del usuario autenticado
  lists: asyncHandler(async (req, res) => {
    // 1️⃣ Buscar todas las categorías creadas por el usuario
    const categories = await Category.find({ user: req.user._id });

    // 2️⃣ Enviar las categorías encontradas como respuesta
    res.status(200).json(categories);
  }),

  //! Actualizar una categoría (solo el dueño o admin)
  update: asyncHandler(async (req, res) => {
    const { type, name, icon } = req.body;
    const { id } = req.params;

    // 1️⃣ Buscar la categoría por su ID
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    // 2️⃣ Verificar si el usuario es dueño o admin
    const isOwner = category.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ message: "No autorizado para actualizar esta categoría" });
    }

    // 3️⃣ Guardar el nombre anterior para actualizar transacciones si cambia
    const oldName = category.name;

    // 4️⃣ Validar y actualizar nombre, tipo e ícono si se proporcionan
    if (name) {
      const normalizedName = name.trim().toLowerCase();
      // Verificar que no exista ya otra categoría con ese nombre para ese usuario
      const duplicate = await Category.findOne({
        name: normalizedName,
        user: category.user, // podría ser admin o usuario común
        _id: { $ne: category._id }, // excluir la actual
      });

      if (duplicate) {
        return res
          .status(409)
          .json({ message: "Ya existe una categoría con ese nombre" });
      }

      category.name = normalizedName;
    }

    if (type) {
      if (!["income", "expense"].includes(type.toLowerCase())) {
        return res.status(400).json({ message: "Tipo de categoría inválido" });
      }
      category.type = type.toLowerCase();
    }

    if (icon) category.icon = icon;

    // 5️⃣ Guardar la categoría actualizada
    const updatedCategory = await category.save();

    // 6️⃣ Si el nombre cambió, actualizar las transacciones que usaban la categoría antigua
    if (oldName !== updatedCategory.name) {
      await Transaction.updateMany(
        {
          user: category.user, // se actualiza según el dueño original
          category: oldName,
        },
        {
          $set: { category: updatedCategory.name },
        }
      );
    }

    // 7️⃣ Enviar la categoría actualizada al cliente
    res.status(200).json(updatedCategory);
  }),

  //! Eliminar una categoría (solo el dueño o admin)
  delete: asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 1️⃣ Buscar la categoría por ID
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    // 2️⃣ Verificar si el usuario es el dueño o es administrador
    const isOwner = category.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "No autorizado para eliminar esta categoría",
      });
    }

    // 3️⃣ Categoría por defecto a la que se reasignarán las transacciones
    const defaultCategory = "Uncategorized";

    // 4️⃣ Actualizar transacciones que usaban esta categoría
    await Transaction.updateMany(
      {
        user: category.user, // usar el dueño original, no req.user
        category: category.name,
      },
      { $set: { category: defaultCategory } }
    );

    // 5️⃣ Eliminar la categoría
    await Category.findByIdAndDelete(id);

    // 6️⃣ Confirmar eliminación al cliente
    res.status(200).json({
      message: `Categoría '${category.name}' eliminada y transacciones actualizadas`,
    });
  }),

  //! Obtener una categoría por ID (solo si pertenece al usuario o si es admin)
  getOne: asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 1️⃣ Validar formato de ID
    if (!id || id.length !== 24) {
      return res.status(400).json({ message: "ID inválido" });
    }

    // 2️⃣ Buscar la categoría por ID
    const category = await Category.findById(id);

    // 3️⃣ Validar existencia
    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    // 4️⃣ Verificar si es el dueño o es admin
    const isOwner = category.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ message: "No autorizado para ver esta categoría" });
    }

    // 5️⃣ Responder con la categoría encontrada
    res.status(200).json(category);
  }),
};

module.exports = categoryController;
