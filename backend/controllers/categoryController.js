const asyncHandler = require("express-async-handler");
const Category = require("../model/Category");
const Transaction = require("../model/Transaccion");

const categoryController = {
  //! CREATE
  create: asyncHandler(async (req, res) => {
    const { name, type, icon } = req.body;

    if (!name || !type) {
      throw new Error("Name and type are required for creating a category");
    }

    const normalizedName = name.toLowerCase();
    const validTypes = ["income", "expense"];

    if (!validTypes.includes(type.toLowerCase())) {
      throw new Error("Invalid category type: " + type);
    }

    const categoryExists = await Category.findOne({
      name: normalizedName,
      user: req.user._id, // ✅ usar solo el ID
    });

    if (categoryExists) {
      throw new Error(
        `Category '${categoryExists.name}' already exists in your list`
      );
    }

    const category = await Category.create({
      name: normalizedName,
      user: req.user._id, // ✅ correcto
      type,
      icon: icon || "📁", // default if not provided
    });

    res.status(201).json(category);
  }),

  //! LIST
  lists: asyncHandler(async (req, res) => {
    const categories = await Category.find({ user: req.user._id }); // ✅
    res.status(200).json(categories);
  }),

  //! UPDATE
  update: asyncHandler(async (req, res) => {
    const { type, name, icon } = req.body;

    const category = await Category.findById(req.params.id);

    if (!category || category.user.toString() !== req.user._id.toString()) {
      throw new Error("Category not found or user not authorized");
    }

    const oldName = category.name;
    if (name) category.name = name.toLowerCase();
    if (type) category.type = type;
    if (icon) category.icon = icon;

    const updatedCategory = await category.save();

    // Actualiza transacciones si cambió el nombre
    if (oldName !== updatedCategory.name) {
      await Transaction.updateMany(
        {
          user: req.user._id,
          category: oldName,
        },
        {
          $set: { category: updatedCategory.name },
        }
      );
    }

    res.json(updatedCategory);
  }),

  //! DELETE
  delete: asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);

    if (!category || category.user.toString() !== req.user._id.toString()) {
      return res
        .status(404)
        .json({ message: "Category not found or not authorized" });
    }

    const defaultCategory = "Uncategorized";

    await Transaction.updateMany(
      { user: req.user._id, category: category.name },
      { $set: { category: defaultCategory } }
    );

    await Category.findByIdAndDelete(req.params.id);

    res.json({ message: "Category removed and transactions updated" });
  }),

  //! GET ONE
  getOne: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category || category.user.toString() !== req.user._id.toString()) {
      return res
        .status(404)
        .json({ message: "Category not found or user not authorized" });
    }

    res.status(200).json(category);
  }),
};

module.exports = categoryController;
