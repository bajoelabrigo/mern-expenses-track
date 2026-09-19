const ExcelJS = require("exceljs");
const asyncHandler = require("express-async-handler");
const Transaction = require("../model/Transaccion");
const {
  parseStartDate,
  parseEndDate,
  getPeriodRange,
  parseTransactionDate,
} = require("../utils/dates");
const { toCents, fromCents } = require("../utils/money");
const { audit, transactionSnapshot } = require("../utils/audit");
const { receiptStorage } = require("../services/receiptStorage");

const TYPES = ["income", "expense"];
const RECURRENCE_TYPES = ["daily", "weekly", "monthly", "yearly"];
const MAX_RECURRENCES = 365;
const MAX_LIMIT = 100;
//! Tope por movimiento: evita que un error de tipeo (un cero de más) o un
//! valor absurdo desborde las sumas.
const MAX_AMOUNT_CENTS = 100_000_000_000; // mil millones

//! Valida un monto de la API (en unidades) y lo devuelve en centavos.
//! Devuelve { error } si no es válido.
const parseAmount = (amount) => {
  const cents = toCents(amount);
  if (cents === null || cents <= 0) {
    return { error: "El monto debe ser un número positivo" };
  }
  if (cents > MAX_AMOUNT_CENTS) {
    return { error: "El monto es demasiado grande" };
  }
  return { cents };
};

//! Construye el filtro común (espacio + fechas + tipo + categoría + anulados).
//! Devuelve { error } si alguno de los parámetros es inválido.
const buildFilters = (workspaceId, query, { includeVoidedByDefault = false } = {}) => {
  const { startDate, endDate, type, category, includeVoided } = query;
  const filters = { workspace: workspaceId };

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

  const showVoided =
    includeVoided === undefined
      ? includeVoidedByDefault
      : String(includeVoided) === "true";
  if (!showVoided) filters.voided = { $ne: true };

  return { filters };
};

//! Suma ingresos y gastos (en centavos) de los movimientos que cumplen el
//! filtro. Los anulados nunca suman, aunque el filtro los incluya.
const sumTotals = async (filters) => {
  const summary = await Transaction.aggregate([
    { $match: { ...filters, voided: { $ne: true } } },
    {
      $group: {
        _id: null,
        income: {
          $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amountCents", 0] },
        },
        expense: {
          $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amountCents", 0] },
        },
      },
    },
  ]);
  const { income = 0, expense = 0 } = summary[0] || {};
  return {
    income: fromCents(income),
    expense: fromCents(expense),
    balance: fromCents(income - expense),
  };
};

//! Busca un movimiento del espacio actual (nunca de otro)
const findInWorkspace = (req) =>
  Transaction.findOne({ _id: req.params.id, workspace: req.workspace._id });

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
      clientId,
    } = req.body;

    //! Reenvío de un movimiento registrado sin conexión que ya había llegado:
    //! se devuelve el existente en vez de crearlo otra vez.
    let normalizedClientId;
    if (clientId !== undefined && clientId !== null && clientId !== "") {
      normalizedClientId = String(clientId).trim();
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(normalizedClientId)) {
        return res.status(400).json({ message: "Identificador de cliente inválido" });
      }
      const existing = await Transaction.find({
        workspace: req.workspace._id,
        clientId: normalizedClientId,
      });
      if (existing.length > 0) return res.status(200).json(existing);
    }

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

    const { cents, error } = parseAmount(amount);
    if (error) return res.status(400).json({ message: error });

    const baseDate = parseTransactionDate(date);
    if (!baseDate) {
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
        //! En una serie recurrente solo el primero lleva el identificador
        ...(normalizedClientId && i === 0 ? { clientId: normalizedClientId } : {}),
        workspace: req.workspace._id,
        createdBy: req.user._id,
        type,
        category: normalizedCategory,
        amountCents: cents,
        description,
        icon,
        date: txDate,
        recurrent: isRecurrent,
        recurrenceType: isRecurrent ? recurrenceType : null,
        recurrenceCount: isRecurrent ? totalCount : 0,
      });
    }

    let created;
    try {
      created = await Transaction.insertMany(transactions);
    } catch (err) {
      //! Dos reenvíos simultáneos del mismo movimiento: el segundo choca con el
      //! índice único y devuelve el que guardó el primero
      if (err.code === 11000 && normalizedClientId) {
        const existing = await Transaction.find({
          workspace: req.workspace._id,
          clientId: normalizedClientId,
        });
        return res.status(200).json(existing);
      }
      throw err;
    }

    //! Una entrada por alta: una serie recurrente se registra una vez, con
    //! cuántos movimientos generó.
    await audit(req, {
      action: "transaction.create",
      entity: "transaction",
      entityId: created[0]._id,
      after: transactionSnapshot(created[0]),
      note: created.length > 1 ? `Serie de ${created.length} movimientos` : "",
    });

    res.status(201).json(created);
  }),

  //! Listado paginado con filtros
  getFilteredTransactions: asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const { filters, error } = buildFilters(req.workspace._id, req.query);
    if (error) return res.status(400).json({ message: error });

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(limit, 10) || 10)
    );
    const skip = (parsedPage - 1) * parsedLimit;

    const [total, transactions] = await Promise.all([
      Transaction.countDocuments(filters),
      Transaction.find(filters)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate("createdBy", "username")
        .populate("voidedBy", "username"),
    ]);

    res.status(200).json({
      total,
      currentPage: parsedPage,
      totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
      limit: parsedLimit,
      transactions,
    });
  }),

  //! Una transacción concreta del espacio actual
  getOne: asyncHandler(async (req, res) => {
    const transaction = await findInWorkspace(req);

    if (!transaction) {
      return res.status(404).json({ message: "Transacción no encontrada" });
    }

    res.status(200).json(transaction);
  }),

  //! Actualizar
  update: asyncHandler(async (req, res) => {
    const transaction = await findInWorkspace(req);

    if (!transaction) {
      return res.status(404).json({ message: "Transacción no encontrada" });
    }

    if (transaction.voided) {
      return res.status(409).json({
        message: "No se puede editar un movimiento anulado. Restáuralo primero.",
      });
    }

    const before = transactionSnapshot(transaction);
    const { type, category, amount, date, description, icon } = req.body;

    if (type !== undefined && !TYPES.includes(type)) {
      return res.status(400).json({ message: "Tipo de transacción inválido" });
    }

    if (amount !== undefined) {
      const { cents, error } = parseAmount(amount);
      if (error) return res.status(400).json({ message: error });
      transaction.amountCents = cents;
    }

    if (date !== undefined) {
      const parsedDate = parseTransactionDate(date);
      if (!parsedDate) {
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

    await audit(req, {
      action: "transaction.update",
      entity: "transaction",
      entityId: transaction._id,
      before,
      after: transactionSnapshot(updatedTransaction),
    });

    res.status(200).json(updatedTransaction);
  }),

  //! Anular (lo normal en vez de borrar). Se mantiene la ruta DELETE /delete/:id
  //! por compatibilidad con los clientes ya desplegados: ahora ANULA.
  void: asyncHandler(async (req, res) => {
    const transaction = await findInWorkspace(req);

    if (!transaction) {
      return res.status(404).json({ message: "Transacción no encontrada" });
    }

    if (transaction.voided) {
      return res.status(409).json({ message: "El movimiento ya está anulado" });
    }

    const reason = String(req.body?.reason || "").trim().slice(0, 300);
    const before = transactionSnapshot(transaction);

    transaction.voided = true;
    transaction.voidReason = reason;
    transaction.voidedAt = new Date();
    transaction.voidedBy = req.user._id;
    await transaction.save();

    await audit(req, {
      action: "transaction.void",
      entity: "transaction",
      entityId: transaction._id,
      before,
      after: transactionSnapshot(transaction),
      note: reason,
    });

    res.status(200).json({ message: "Movimiento anulado", transaction });
  }),

  //! Deshacer una anulación
  restore: asyncHandler(async (req, res) => {
    const transaction = await findInWorkspace(req);

    if (!transaction) {
      return res.status(404).json({ message: "Transacción no encontrada" });
    }

    if (!transaction.voided) {
      return res.status(409).json({ message: "El movimiento no está anulado" });
    }

    const before = transactionSnapshot(transaction);

    transaction.voided = false;
    transaction.voidReason = "";
    transaction.voidedAt = null;
    transaction.voidedBy = null;
    await transaction.save();

    await audit(req, {
      action: "transaction.restore",
      entity: "transaction",
      entityId: transaction._id,
      before,
      after: transactionSnapshot(transaction),
    });

    res.status(200).json({ message: "Movimiento restaurado", transaction });
  }),

  //! Borrado definitivo. Es para lo que NUNCA fue dinero (una prueba, un
  //! duplicado); queda en el historial con los datos que tenía.
  purge: asyncHandler(async (req, res) => {
    const transaction = await findInWorkspace(req);

    if (!transaction) {
      return res.status(404).json({ message: "Transacción no encontrada" });
    }

    const before = transactionSnapshot(transaction);
    const receipt = transaction.receipt;
    await transaction.deleteOne();

    //! El comprobante se va con el movimiento. Si Cloudinary falla, el
    //! movimiento ya no existe: se registra para limpiarlo a mano.
    if (receipt) {
      await receiptStorage.destroy(receipt).catch((err) =>
        console.error(`[receipt] No se borró ${receipt.publicId}:`, err.message)
      );
    }

    await audit(req, {
      action: "transaction.purge",
      entity: "transaction",
      entityId: transaction._id,
      before,
    });

    res.status(200).json({ message: "Movimiento eliminado definitivamente" });
  }),

  //! Adjuntar (o reemplazar) el comprobante. El archivo ya viene validado por
  //! el middleware receiptUpload.
  attachReceipt: asyncHandler(async (req, res) => {
    if (!receiptStorage.isConfigured()) {
      return res
        .status(503)
        .json({ message: "Los comprobantes no están disponibles en este servidor" });
    }

    const transaction = await findInWorkspace(req);
    if (!transaction) {
      return res.status(404).json({ message: "Transacción no encontrada" });
    }
    if (transaction.voided) {
      return res
        .status(409)
        .json({ message: "No se puede adjuntar a un movimiento anulado" });
    }

    const previous = transaction.receipt;
    const stored = await receiptStorage.upload({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      workspaceId: String(req.workspace._id),
    });

    transaction.receipt = { ...stored, uploadedAt: new Date(), uploadedBy: req.user._id };
    await transaction.save();

    //! El anterior se borra DESPUÉS de guardar el nuevo: si algo falla antes,
    //! el movimiento sigue teniendo un comprobante válido
    if (previous) {
      await receiptStorage.destroy(previous).catch((err) =>
        console.error(`[receipt] No se borró ${previous.publicId}:`, err.message)
      );
    }

    await audit(req, {
      action: previous ? "receipt.replace" : "receipt.attach",
      entity: "transaction",
      entityId: transaction._id,
      after: { receipt: stored.format || stored.resourceType },
    });

    res.status(200).json(transaction);
  }),

  //! Enlace temporal para ver el comprobante (quien pueda ver el movimiento)
  getReceipt: asyncHandler(async (req, res) => {
    const transaction = await findInWorkspace(req);
    if (!transaction || !transaction.receipt) {
      return res.status(404).json({ message: "Este movimiento no tiene comprobante" });
    }
    if (!receiptStorage.isConfigured()) {
      return res
        .status(503)
        .json({ message: "Los comprobantes no están disponibles en este servidor" });
    }

    res.status(200).json({
      url: receiptStorage.viewUrl(transaction.receipt),
      format: transaction.receipt.format,
    });
  }),

  //! Quitar el comprobante
  removeReceipt: asyncHandler(async (req, res) => {
    const transaction = await findInWorkspace(req);
    if (!transaction || !transaction.receipt) {
      return res.status(404).json({ message: "Este movimiento no tiene comprobante" });
    }

    const receipt = transaction.receipt;
    transaction.receipt = null;
    await transaction.save();
    await receiptStorage.destroy(receipt).catch((err) =>
      console.error(`[receipt] No se borró ${receipt.publicId}:`, err.message)
    );

    await audit(req, {
      action: "receipt.remove",
      entity: "transaction",
      entityId: transaction._id,
    });

    res.status(200).json({ message: "Comprobante eliminado" });
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
      workspace: req.workspace._id,
      date: { $gte: finalStartDate, $lte: finalEndDate },
      voided: { $ne: true },
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
    const { filters, error } = buildFilters(req.workspace._id, req.query);
    if (error) return res.status(400).json({ message: error });

    res.status(200).json(await sumTotals(filters));
  }),

  //! Resumen del mes en curso
  getMonthlySummary: asyncHandler(async (req, res) => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const { income, expense } = await sumTotals({
      workspace: req.workspace._id,
      date: { $gte: startOfMonth, $lte: endOfToday },
    });

    res.status(200).json({ income, expense });
  }),

  //! Exportar a Excel respetando los filtros activos
  generateExcelReport: asyncHandler(async (req, res) => {
    const { filters, error } = buildFilters(req.workspace._id, req.query);
    if (error) return res.status(400).json({ message: error });

    const transactions = await Transaction.find(filters).sort({ date: -1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transacciones");

    sheet.columns = [
      { header: "Fecha", key: "date", width: 15 },
      { header: "Tipo", key: "type", width: 10 },
      { header: "Categoría", key: "category", width: 20 },
      { header: "Descripción", key: "description", width: 30 },
      { header: `Monto (${req.workspace.currency})`, key: "amount", width: 14 },
      { header: "Estado", key: "status", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };

    //! Los totales se suman en centavos y se convierten al final
    let incomeCents = 0;
    let expenseCents = 0;

    transactions.forEach((tx) => {
      if (!tx.voided) {
        if (tx.type === "income") incomeCents += tx.amountCents;
        else expenseCents += tx.amountCents;
      }

      sheet.addRow({
        date: new Date(tx.date).toLocaleDateString("es-PE"),
        type: tx.type === "income" ? "Ingreso" : "Gasto",
        category: tx.category || "Sin categoría",
        description: tx.description || "",
        amount: tx.amount,
        status: tx.voided ? "Anulado" : "",
      });
    });

    //! Totales al pie del reporte
    sheet.addRow({});
    sheet.addRow({ category: "Total ingresos", amount: fromCents(incomeCents) }).font = {
      bold: true,
    };
    sheet.addRow({ category: "Total gastos", amount: fromCents(expenseCents) }).font = {
      bold: true,
    };
    sheet.addRow({
      category: "Balance",
      amount: fromCents(incomeCents - expenseCents),
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
