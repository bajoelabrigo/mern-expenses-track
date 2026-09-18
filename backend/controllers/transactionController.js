const ExcelJS = require("exceljs");
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const Transaction = require("../model/Transaccion");
const { parseStartDate, parseEndDate, getPeriodRange } = require("../utils/dates");

const TYPES = ["income", "expense"];
const RECURRENCE_TYPES = ["daily", "weekly", "monthly", "yearly"];
const MAX_RECURRENCES = 365;
const MAX_LIMIT = 100;

//! Construye el filtro común (usuario + fechas + tipo + categoría).
//! Devuelve { error } si alguno de los parámetros es inválido.
const buildFilters = (userId, query) => {
  const { startDate, endDate, type, category } = query;
  const filters = { user: userId };

  const parsedStart = parseStartDate(startDate);
  if (parsedStart === undefined) {
    return { error: "Fecha de inicio inválida" };
  }
  const parsedEnd = parseEndDate(endDate);
  if (parsedEnd === undefined) {
    return { error: "Fecha de fin inválida" };
  }

  if (parsedStart) filters.date = { ...filters.date, $gte: parsedStart };
  if (parsedEnd) filters.date = { ...filters.date, $lte: parsedEnd };

  if (type) {
    if (!TYPES.includes(type)) {
      return { error: "Tipo de transacción inválido" };
    }
    filters.type = type;
  }

  if (category && category !== "All" && category !== "all") {
    filters.category = String(category).trim().toLowerCase();
  }

  return { filters };
};

const transactionController = {
  //! Crear una o varias transacciones (si es recurrente)
  create: asyncHandler(async (req, res) => {
    const {
      type,
      category,
      amount,
      date,
      description = "",
      icon = "",
      recurrent = false,
      recurrenceType,
      recurrenceCount = 1,
    } = req.body;

    if (!type || amount === undefined || amount === null || !date) {
      return res
        .status(400)
        .json({ message: "Tipo, monto y fecha son obligatorios" });
    }

    if (!TYPES.includes(type)) {
      return res
        .status(400)
        .json({ message: "El tipo debe ser 'income' o 'expense'" });
    }

    const parsedAmount = parseFloat(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res
        .status(400)
        .json({ message: "El monto debe ser un número positivo" });
    }

    const baseDate = new Date(date);
    if (Number.isNaN(baseDate.getTime())) {
      return res.status(400).json({ message: "Fecha inválida" });
    }

    const isRecurrent = Boolean(recurrent);
    let totalCount = 1;

    if (isRecurrent) {
      if (!RECURRENCE_TYPES.includes(recurrenceType)) {
        return res.status(400).json({
          message: `Tipo de recurrencia inválido. Usa: ${RECURRENCE_TYPES.join(", ")}`,
        });
      }

      totalCount = parseInt(recurrenceCount, 10);
      if (Number.isNaN(totalCount) || totalCount < 1) {
        return res
          .status(400)
          .json({ message: "La cantidad de repeticiones debe ser al menos 1" });
      }
      if (totalCount > MAX_RECURRENCES) {
        return res.status(400).json({
          message: `La cantidad de repeticiones no puede superar ${MAX_RECURRENCES}`,
        });
      }
    }

    const normalizedCategory = category
      ? String(category).trim().toLowerCase()
      : "uncategorized";

    const transactions = [];

    for (let i = 0; i < totalCount; i += 1) {
      const txDate = new Date(baseDate);

      if (i > 0) {
        switch (recurrenceType) {
          case "daily":
            txDate.setDate(txDate.getDate() + i);
            break;
          case "weekly":
            txDate.setDate(txDate.getDate() + i * 7);
            break;
          case "monthly":
            txDate.setMonth(txDate.getMonth() + i);
            break;
          case "yearly":
            txDate.setFullYear(txDate.getFullYear() + i);
            break;
          default:
            break;
        }
      }

      transactions.push({
        user: req.user._id,
        type,
        category: normalizedCategory,
        amount: parsedAmount,
        description,
        icon,
        date: txDate,
        recurrent: isRecurrent,
        recurrenceType: isRecurrent ? recurrenceType : null,
        recurrenceCount: isRecurrent ? totalCount : 0,
      });
    }

    const created = await Transaction.insertMany(transactions);

    res.status(201).json(created);
  }),

  //! Listado paginado con filtros
  getFilteredTransactions: asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const { filters, error } = buildFilters(req.user._id, req.query);
    if (error) return res.status(400).json({ message: error });

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(limit, 10) || 10)
    );
    const skip = (parsedPage - 1) * parsedLimit;

    const [total, transactions] = await Promise.all([
      Transaction.countDocuments(filters),
      Transaction.find(filters).sort({ date: -1 }).skip(skip).limit(parsedLimit),
    ]);

    res.status(200).json({
      total,
      currentPage: parsedPage,
      totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
      limit: parsedLimit,
      transactions,
    });
  }),

  //! Una transacción concreta del usuario autenticado
  getOne: asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transacción no encontrada" });
    }

    res.status(200).json(transaction);
  }),

  //! Actualizar (solo el dueño)
  update: asyncHandler(async (req, res) => {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: "Transacción no encontrada" });
    }

    if (transaction.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "No autorizado para modificar esta transacción" });
    }

    const { type, category, amount, date, description, icon } = req.body;

    if (type !== undefined && !TYPES.includes(type)) {
      return res.status(400).json({ message: "Tipo de transacción inválido" });
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

    if (type !== undefined) transaction.type = type;
    if (category !== undefined) {
      transaction.category = String(category).trim().toLowerCase();
    }
    if (description !== undefined) transaction.description = description;
    if (icon !== undefined) transaction.icon = icon;

    const updatedTransaction = await transaction.save();

    res.status(200).json(updatedTransaction);
  }),

  //! Eliminar (solo el dueño)
  delete: asyncHandler(async (req, res) => {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: "Transacción no encontrada" });
    }

    if (transaction.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "No autorizado para eliminar esta transacción" });
    }

    await transaction.deleteOne();

    res.status(200).json({ message: "Transacción eliminada exitosamente" });
  }),

  //! Transacciones por período (o rango personalizado), con filtro de categoría
  getByPeriod: asyncHandler(async (req, res) => {
    const { period, type, startDate, endDate, category } = req.query;

    const parsedStart = parseStartDate(startDate);
    if (parsedStart === undefined) {
      return res.status(400).json({ message: "Fecha de inicio inválida" });
    }
    const parsedEnd = parseEndDate(endDate);
    if (parsedEnd === undefined) {
      return res.status(400).json({ message: "Fecha de fin inválida" });
    }

    let finalStartDate = parsedStart;
    let finalEndDate = parsedEnd;

    //! Si falta alguna de las dos fechas se completa con el período pedido
    if (!finalStartDate || !finalEndDate) {
      const range = getPeriodRange(period || "monthly");
      if (!range) {
        return res.status(400).json({
          message:
            "Período inválido. Usa: monthly, bimonthly, quarterly, semiannual, annual",
        });
      }
      finalStartDate = finalStartDate || range.start;
      finalEndDate = finalEndDate || range.end;
    }

    const filters = {
      user: req.user._id,
      date: { $gte: finalStartDate, $lte: finalEndDate },
    };

    if (type) {
      if (!TYPES.includes(type)) {
        return res
          .status(400)
          .json({ message: "Tipo inválido. Usa 'income' o 'expense'" });
      }
      filters.type = type;
    }

    if (category && category !== "All" && category !== "all") {
      filters.category = String(category).trim().toLowerCase();
    }

    const transactions = await Transaction.find(filters).sort({ date: -1 });

    res.status(200).json(transactions);
  }),

  //! Balance general (con filtros opcionales)
  getBalance: asyncHandler(async (req, res) => {
    const { filters, error } = buildFilters(req.user._id, req.query);
    if (error) return res.status(400).json({ message: error });

    //! Las agregaciones NO castean tipos: el id debe ser un ObjectId real
    const match = {
      ...filters,
      user: new mongoose.Types.ObjectId(req.user._id),
    };

    const summary = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
        },
      },
    ]);

    const { totalIncome = 0, totalExpense = 0 } = summary[0] || {};

    res.status(200).json({
      income: totalIncome,
      expense: totalExpense,
      balance: totalIncome - totalExpense,
    });
  }),

  //! Resumen del mes en curso
  getMonthlySummary: asyncHandler(async (req, res) => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const summary = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user._id),
          date: { $gte: startOfMonth, $lte: endOfToday },
        },
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
        },
      },
    ]);

    res.status(200).json({
      income: summary.find((s) => s._id === "income")?.total || 0,
      expense: summary.find((s) => s._id === "expense")?.total || 0,
    });
  }),

  //! Exportar a Excel respetando los filtros activos
  generateExcelReport: asyncHandler(async (req, res) => {
    const { filters, error } = buildFilters(req.user._id, req.query);
    if (error) return res.status(400).json({ message: error });

    const transactions = await Transaction.find(filters).sort({ date: -1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transacciones");

    sheet.columns = [
      { header: "Fecha", key: "date", width: 15 },
      { header: "Tipo", key: "type", width: 10 },
      { header: "Categoría", key: "category", width: 20 },
      { header: "Descripción", key: "description", width: 30 },
      { header: "Monto", key: "amount", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((tx) => {
      if (tx.type === "income") totalIncome += tx.amount;
      else totalExpense += tx.amount;

      sheet.addRow({
        date: new Date(tx.date).toLocaleDateString("es-PE"),
        type: tx.type === "income" ? "Ingreso" : "Gasto",
        category: tx.category || "Sin categoría",
        description: tx.description || "",
        amount: tx.amount,
      });
    });

    //! Totales al pie del reporte
    sheet.addRow({});
    sheet.addRow({ category: "Total ingresos", amount: totalIncome }).font = {
      bold: true,
    };
    sheet.addRow({ category: "Total gastos", amount: totalExpense }).font = {
      bold: true,
    };
    sheet.addRow({
      category: "Balance",
      amount: totalIncome - totalExpense,
    }).font = { bold: true };

    sheet.getColumn("amount").numFmt = "#,##0.00";

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=transacciones.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    await workbook.xlsx.write(res);
    res.end();
  }),
};

module.exports = transactionController;
