const ExcelJS = require("exceljs");
const asyncHandler = require("express-async-handler");
const Category = require("../model/Category");
const Transaction = require("../model/Transaccion");

const transactionController = {
  //! Crear transacción
  create: asyncHandler(async (req, res) => {
    const {
      type,
      category,
      amount,
      date,
      description,
      icon,
      recurrent,
      recurrenceType,
      recurrenceCount,
    } = req.body;

    if (!amount || !type || !date) {
      throw new Error("Type, amount and date are required");
    }

    const baseDate = new Date(date);
    const transactions = [];

    const recurrenceIntervals = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      yearly: 365,
    };

    const totalCount = recurrent && recurrenceCount > 0 ? recurrenceCount : 1;

    for (let i = 0; i < totalCount; i++) {
      const txDate = new Date(baseDate);
      if (i > 0 && recurrent && recurrenceType) {
        switch (recurrenceType) {
          case "daily":
            txDate.setDate(txDate.getDate() + i * recurrenceIntervals.daily);
            break;
          case "weekly":
            txDate.setDate(txDate.getDate() + i * recurrenceIntervals.weekly);
            break;
          case "monthly":
            txDate.setMonth(txDate.getMonth() + i);
            break;
          case "yearly":
            txDate.setFullYear(txDate.getFullYear() + i);
            break;
        }
      }

      transactions.push({
        user: req.user._id, // ✅ Usar solo el ID
        type,
        category,
        amount,
        description,
        icon,
        date: txDate,
        recurrent: Boolean(recurrent),
        recurrenceType: recurrent ? recurrenceType : null,
        recurrenceCount: recurrent ? recurrenceCount : 0,
      });
    }

    const created = await Transaction.insertMany(transactions);
    res.status(201).json(created);
  }),

  //! Listar con filtros
  getFilteredTransactions: asyncHandler(async (req, res) => {
    const { startDate, endDate, type, category } = req.query;
    let filters = { user: req.user._id };

    if (startDate) {
      filters.date = { ...filters.date, $gte: new Date(startDate) };
    }
    if (endDate) {
      filters.date = { ...filters.date, $lte: new Date(endDate) };
    }
    if (type) filters.type = type;
    if (category) {
      if (category === "All") {
        // no filtramos
      } else if (category === "Uncategorized") {
        filters.category = "Uncategorized";
      } else {
        filters.category = category;
      }
    }

    const transactions = await Transaction.find(filters).sort({ date: -1 });
    res.json(transactions);
  }),

  //! Obtener una sola transacción
  getOne: asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json(transaction);
  }),

  //! Actualizar
  update: asyncHandler(async (req, res) => {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    transaction.type = req.body.type ?? transaction.type;
    transaction.category = req.body.category ?? transaction.category;
    transaction.amount = req.body.amount ?? transaction.amount;
    transaction.date = req.body.date ?? transaction.date;
    transaction.description = req.body.description ?? transaction.description;

    const updatedTransaction = await transaction.save();
    res.json(updatedTransaction);
  }),

  //! Eliminar
  delete: asyncHandler(async (req, res) => {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await transaction.deleteOne();
    res.json({ message: "Transaction removed" });
  }),

  //! Obtener transacciones por período
  getByPeriod: asyncHandler(async (req, res) => {
    const { period, type } = req.query;
    const today = new Date();
    let startDate;

    switch (period) {
      case "monthly":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case "bimonthly":
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        break;
      case "quarterly":
        startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        break;
      case "semiannual":
        startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        break;
      case "annual":
        startDate = new Date(today.getFullYear() - 1, today.getMonth(), 1);
        break;
      default:
        return res.status(400).json({ message: "Invalid period value" });
    }

    const filters = {
      user: req.user._id,
      date: { $gte: startDate, $lte: today },
    };

    if (type) filters.type = type;

    const transactions = await Transaction.find(filters).sort({ date: -1 });
    res.json(transactions);
  }),

  //! Resumen mensual para gráfico de barras
  getMonthlySummary: asyncHandler(async (req, res) => {
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    oneYearAgo.setMonth(today.getMonth());
    oneYearAgo.setDate(1);
    oneYearAgo.setHours(0, 0, 0, 0);

    const summary = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: oneYearAgo, $lte: today },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          totalIncome: {
            $sum: {
              $cond: [{ $eq: ["$type", "income"] }, "$amount", 0],
            },
          },
          totalExpense: {
            $sum: {
              $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const formatted = summary.map((item) => ({
      year: item._id.year,
      month: item._id.month,
      income: item.totalIncome,
      expense: item.totalExpense,
      balance: item.totalIncome - item.totalExpense,
    }));

    res.json(formatted);
  }),

  //! Balance general
  getBalance: asyncHandler(async (req, res) => {
    const summary = await Transaction.aggregate([
      {
        $match: { user: req.user._id },
      },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: {
              $cond: [{ $eq: ["$type", "income"] }, "$amount", 0],
            },
          },
          totalExpense: {
            $sum: {
              $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const result = summary[0] || { totalIncome: 0, totalExpense: 0 };

    res.json({
      income: result.totalIncome,
      expense: result.totalExpense,
      balance: result.totalIncome - result.totalExpense,
    });
  }),

  //! Exportar a Excel
  generateExcelReport: asyncHandler(async (req, res) => {
    const transactions = await Transaction.find({ user: req.user._id }).sort({
      date: -1,
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transactions");

    sheet.columns = [
      { header: "Fecha", key: "date", width: 15 },
      { header: "Tipo", key: "type", width: 10 },
      { header: "Categoria", key: "category", width: 20 },
      { header: "Descripcion", key: "description", width: 30 },
      { header: "Monto", key: "amount", width: 10 },
      { header: "Icono", key: "icon", width: 10 },
    ];

    transactions.forEach((tx) => {
      sheet.addRow({
        date: new Date(tx.date).toLocaleDateString("es-PE"),
        type: tx.type,
        category: tx.category,
        description: tx.description || "",
        amount: tx.amount,
        icon: tx.icon || "",
      });
    });

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
