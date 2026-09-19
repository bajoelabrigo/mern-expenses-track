const asyncHandler = require("express-async-handler");
const Category = require("../model/Category");
const Transaction = require("../model/Transaccion");
const { audit, categorySnapshot } = require("../utils/audit");
const {
  INCOME_KINDS,
  CHURCH_INCOME_CATEGORIES,
  effectiveIncomeKind,
} = require("../utils/incomeKinds");

const TYPES = ["income", "expense"];
const DEFAULT_CATEGORY = "uncategorized";

//! Tipo de ingreso que manda el cliente: undefined = no se toca; null o "" =
//! que se deduzca del nombre. Devuelve { value } o { error }.
const parseIncomeKind = (value) => {
  if (value === undefined) return { unchanged: true };
  if (value === null || value === "") return { value: null };
  const kind = String(value).trim().toLowerCase();
  if (!INCOME_KINDS.includes(kind)) {
    return { error: `Tipo de ingreso inválido. Usa: ${INCOME_KINDS.join(", ")}` };
  }
  return { value: kind };
};

//! Busca una categoría del espacio actual (nunca de otro)
const findInWorkspace = (req) =>
  Category.findOne({ _id: req.params.id, workspace: req.workspace._id });

const categoryController = {
  //! Crear categoría en el espacio actual
  create: asyncHandler(async (req, res) => {
    const { name, type, icon, incomeKind } = req.body;

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

    const kind = parseIncomeKind(incomeKind);
    if (kind.error) return res.status(400).json({ message: kind.error });

    const category = await Category.create({
      name: normalizedName,
      workspace: req.workspace._id,
      type: normalizedType,
      icon: icon || "📁",
      //! Solo las de ingreso llevan tipo
      incomeKind: normalizedType === "income" && !kind.unchanged ? kind.value : null,
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
    const { type, name, icon, incomeKind } = req.body;
    const kind = parseIncomeKind(incomeKind);
    if (kind.error) return res.status(400).json({ message: kind.error });

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
    if (!kind.unchanged) category.incomeKind = kind.value;
    //! Una categoría que pasa a ser de gasto deja de tener tipo de ingreso
    if (category.type !== "income") category.incomeKind = null;

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

  //! Agrega las categorías de ingreso de iglesia que falten (Diezmos,
  //! Ofrendas, Primicias, Ofrenda especial). Una ya está si hay alguna
  //! categoría de ese tipo, se llame como se llame: no se duplica "Diezmo".
  addChurchDefaults: asyncHandler(async (req, res) => {
    const existing = await Category.find({ workspace: req.workspace._id });
    const kinds = new Set(existing.map(effectiveIncomeKind).filter(Boolean));
    const names = new Set(existing.map((c) => c.name));

    const missing = CHURCH_INCOME_CATEGORIES.filter(
      (c) => !kinds.has(c.incomeKind) && !names.has(c.name)
    );

    const added = [];
    for (const base of missing) {
      const category = await Category.create({ ...base, type: "income", workspace: req.workspace._id });
      added.push(category);
      await audit(req, {
        action: "category.create",
        entity: "category",
        entityId: category._id,
        after: categorySnapshot(category),
        note: "Categoría base de iglesia",
      });
    }

    res.status(added.length ? 201 : 200).json({ added });
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
