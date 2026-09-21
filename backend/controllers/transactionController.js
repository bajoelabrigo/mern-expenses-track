const ExcelJS = require("exceljs");
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const Transaction = require("../model/Transaccion");
const Fund = require("../model/Fund");
const Category = require("../model/Category");
const Donor = require("../model/Donor");
const { effectiveIncomeKind, inferIncomeKind } = require("../utils/incomeKinds");
const { isValidPaymentKind, PAYMENT_KIND_LABELS } = require("../utils/paymentKinds");
const { can } = require("../utils/permissions");
const {
  parseStartDate,
  parseEndDate,
  getPeriodRange,
  parseTransactionDate,
  upToToday,
} = require("../utils/dates");
const { toCents, fromCents } = require("../utils/money");
const { audit, transactionSnapshot } = require("../utils/audit");
const { receiptStorage } = require("../services/receiptStorage");
const { GENERAL_KEY, fundName, resolveFund } = require("../services/fundService");
const Ministry = require("../model/Ministry");

//! El ministerio al que se carga un gasto: undefined = no se toca; null o ""
//! = ninguno. Tiene que ser de este espacio y no estar archivado.
const resolveMinistry = async (workspaceId, value) => {
  if (value === undefined) return { unchanged: true };
  if (value === null || value === "") return { ministry: null };
  if (!mongoose.isValidObjectId(value)) return { error: "Ministerio inválido", status: 400 };

  const ministry = await Ministry.findOne({ _id: value, workspace: workspaceId });
  if (!ministry) return { error: "Ese ministerio no existe en este espacio", status: 404 };
  if (ministry.archived) {
    return { error: `El ministerio "${ministry.name}" está archivado`, status: 409 };
  }
  return { ministry };
};

const TYPES = ["income", "expense"];
const INCOME_KIND_LABELS = {
  diezmo: "Diezmo",
  ofrenda: "Ofrenda",
  primicia: "Primicia",
  especial: "Ofrenda especial",
  otro: "Otro ingreso",
};
const RECURRENCE_TYPES = ["daily", "weekly", "monthly", "yearly"];
const MAX_RECURRENCES = 365;
const MAX_LIMIT = 100;
//! Tope por movimiento: evita que un error de tipeo (un cero de más) o un
//! valor absurdo desborde las sumas.
const MAX_AMOUNT_CENTS = 100_000_000_000; // mil millones

//! Quién dio o recibió cuánto solo lo ve la tesorería: a los demás se les quita
//! la persona de cada movimiento antes de responder (esconderlo solo en la
//! pantalla no serviría de nada).
const seesDonors = (req) => can(req.role, "donor:read");
const visible = (req, doc) => {
  if (seesDonors(req)) return doc;
  const json = doc && typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  delete json.donor;
  delete json.payee;
  return json;
};
const visibleList = (req, docs) => (seesDonors(req) ? docs : docs.map((d) => visible(req, d)));

//! El aportante que manda el cliente: undefined = no se toca; null o "" = sin
//! aportante. Solo tiene sentido en los ingresos.
const resolveDonor = async (workspaceId, value) => {
  if (value === undefined) return { unchanged: true };
  if (value === null || value === "") return { donor: null };
  if (!mongoose.isValidObjectId(value)) return { error: "Aportante inválido", status: 400 };
  const donor = await Donor.findOne({ _id: value, workspace: workspaceId });
  if (!donor) return { error: "Ese aportante no existe en este espacio", status: 404 };
  return { donor };
};

//! A quién se le pagó: misma ficha que el aportante, pero en un gasto.
const resolvePayee = async (workspaceId, value) => {
  if (value === undefined) return { unchanged: true };
  if (value === null || value === "") return { payee: null };
  if (!mongoose.isValidObjectId(value)) return { error: "Persona inválida", status: 400 };
  const payee = await Donor.findOne({ _id: value, workspace: workspaceId });
  if (!payee) return { error: "Esa persona no existe en este espacio", status: 404 };
  return { payee };
};

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
//! `puedeFiltrarPersonas` (donor:read) va cerrado por defecto: filtrar por una
//! persona ya revela —devuelve solo SUS movimientos y con ellos los importes—,
//! así que no basta con ocultar el campo en la respuesta.
const buildFilters = (
  workspaceId,
  query,
  { includeVoidedByDefault = false, puedeFiltrarPersonas = false } = {}
) => {
  const { startDate, endDate, type, category, includeVoided, q, recurrent, fund } = query;
  const filters = { workspace: workspaceId };

  //! Búsqueda en descripción y categoría. El texto se escapa: es una búsqueda
  //! literal, no una expresión regular que alguien pueda usar para colgar Mongo.
  if (q !== undefined && q !== "") {
    const text = String(q).trim().slice(0, 60);
    if (text) {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filters.$or = [{ description: regex }, { category: regex }];
    }
  }

  if (recurrent !== undefined && recurrent !== "") {
    filters.recurrent = String(recurrent) === "true";
  }

  //! Aportante (solo para quien puede verlos): un id o "sin" para los ingresos
  //! sin aportante
  if (query.donor !== undefined && query.donor !== "") {
    if (!puedeFiltrarPersonas) {
      return { error: "Tu rol no permite filtrar por aportante", status: 403 };
    }
    if (query.donor === "sin") filters.donor = null;
    else if (mongoose.isValidObjectId(query.donor)) filters.donor = query.donor;
    else return { error: "Aportante inválido" };
  }

  //! A quién se le pagó: un id o "sin" para los gastos sin persona
  if (query.payee !== undefined && query.payee !== "") {
    if (!puedeFiltrarPersonas) {
      return { error: "Tu rol no permite filtrar por persona", status: 403 };
    }
    if (query.payee === "sin") filters.payee = null;
    else if (mongoose.isValidObjectId(query.payee)) filters.payee = query.payee;
    else return { error: "Persona inválida" };
  }

  //! Fondo: "general" son los que no tienen fondo (null también cubre los
  //! movimientos viejos que no tienen el campo)
  if (fund !== undefined && fund !== "") {
    if (fund === GENERAL_KEY) filters.fund = null;
    else if (mongoose.isValidObjectId(fund)) filters.fund = fund;
    else return { error: "Fondo inválido" };
  }

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
//! filtro. Los anulados nunca suman, aunque el filtro los incluya, y lo que
//! tiene fecha futura tampoco: todavía no ha pasado.
const sumTotals = async (filters) => {
  const summary = await Transaction.aggregate([
    { $match: { ...upToToday(filters), voided: { $ne: true } } },
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
      fund,
      donor,
      payee,
      paymentKind,
      ministry,
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
      if (existing.length > 0) return res.status(200).json(visibleList(req, existing));
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

    const resolved = await resolveFund(req.workspace._id, fund);
    if (resolved.error) return res.status(resolved.status).json({ message: resolved.error });
    const fundDoc = resolved.fund || null;

    //! Registrar a nombre de alguien exige poder ver aportantes
    const resolvedDonor = await resolveDonor(req.workspace._id, donor);
    if (resolvedDonor.error) {
      return res.status(resolvedDonor.status).json({ message: resolvedDonor.error });
    }
    //! Y a quién se le pagó, lo mismo (misma ficha, misma privacidad)
    const resolvedPayee = await resolvePayee(req.workspace._id, payee);
    if (resolvedPayee.error) {
      return res.status(resolvedPayee.status).json({ message: resolvedPayee.error });
    }
    //! El ministerio solo tiene sentido en un gasto: es contra su presupuesto
    const resolvedMinistry = await resolveMinistry(req.workspace._id, ministry);
    if (resolvedMinistry.error) {
      return res.status(resolvedMinistry.status).json({ message: resolvedMinistry.error });
    }
    const ministryDoc = resolvedMinistry.ministry || null;
    if (ministryDoc && type !== "expense") {
      return res.status(400).json({ message: "Solo los gastos se cargan a un ministerio" });
    }

    const donorDoc = resolvedDonor.donor || null;
    if (donorDoc && !seesDonors(req)) {
      return res.status(403).json({ message: "Tu rol no permite registrar a nombre de un aportante" });
    }
    if (donorDoc && type !== "income") {
      return res.status(400).json({ message: "Solo los ingresos llevan aportante" });
    }

    const payeeDoc = resolvedPayee.payee || null;
    if (payeeDoc && !seesDonors(req)) {
      return res.status(403).json({ message: "Tu rol no permite registrar a quién se le pagó" });
    }
    if (payeeDoc && type !== "expense") {
      return res.status(400).json({ message: "Solo los gastos llevan a quién se le pagó" });
    }

    //! El concepto del pago solo acompaña a un pago; sin persona no se guarda
    const kindDoc = payeeDoc && paymentKind ? String(paymentKind) : null;
    if (kindDoc && !isValidPaymentKind(kindDoc)) {
      return res.status(400).json({ message: "Concepto de pago no válido" });
    }

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
        fund: fundDoc ? fundDoc._id : null,
        donor: donorDoc ? donorDoc._id : null,
        payee: payeeDoc ? payeeDoc._id : null,
        paymentKind: kindDoc,
        ministry: ministryDoc ? ministryDoc._id : null,
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
        return res.status(200).json(visibleList(req, existing));
      }
      throw err;
    }

    //! Una entrada por alta: una serie recurrente se registra una vez, con
    //! cuántos movimientos generó.
    await audit(req, {
      action: "transaction.create",
      entity: "transaction",
      entityId: created[0]._id,
      //! El fondo solo se anota si no es el General (en un espacio sin fondos
      //! sería ruido en cada entrada)
      after: transactionSnapshot(created[0], fundDoc ? fundName(fundDoc) : undefined),
      note: created.length > 1 ? `Serie de ${created.length} movimientos` : "",
    });

    res.status(201).json(visibleList(req, created));
  }),

  //! Listado paginado con filtros
  getFilteredTransactions: asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const { filters, error, status } = buildFilters(req.workspace._id, req.query, {
      puedeFiltrarPersonas: seesDonors(req),
    });
    if (error) return res.status(status || 400).json({ message: error });

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
        .populate("voidedBy", "username")
        .populate("fund", "name icon")
        .populate("donor", "name")
        .populate("payee", "name"),
    ]);

    res.status(200).json({
      total,
      currentPage: parsedPage,
      totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
      limit: parsedLimit,
      transactions: visibleList(req, transactions),
    });
  }),

  //! Una transacción concreta del espacio actual
  getOne: asyncHandler(async (req, res) => {
    const transaction = await findInWorkspace(req);

    if (!transaction) {
      return res.status(404).json({ message: "Transacción no encontrada" });
    }

    res.status(200).json(visible(req, transaction));
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

    const { type, category, amount, date, description, icon, fund, donor, payee, paymentKind, ministry } = req.body;

    //! Nombre del fondo antes y después, para que el historial se lea solo
    const currentFund = transaction.fund
      ? await Fund.findOne({ _id: transaction.fund, workspace: req.workspace._id })
      : null;
    const resolved = await resolveFund(req.workspace._id, fund, { current: transaction.fund });
    if (resolved.error) return res.status(resolved.status).json({ message: resolved.error });
    const nextFund = resolved.unchanged ? currentFund : resolved.fund;

    const resolvedDonor = await resolveDonor(req.workspace._id, donor);
    if (resolvedDonor.error) {
      return res.status(resolvedDonor.status).json({ message: resolvedDonor.error });
    }
    if (!resolvedDonor.unchanged && !seesDonors(req)) {
      return res.status(403).json({ message: "Tu rol no permite cambiar el aportante" });
    }
    const resolvedPayee = await resolvePayee(req.workspace._id, payee);
    if (resolvedPayee.error) {
      return res.status(resolvedPayee.status).json({ message: resolvedPayee.error });
    }
    if (!resolvedPayee.unchanged && !seesDonors(req)) {
      return res.status(403).json({ message: "Tu rol no permite cambiar a quién se le pagó" });
    }
    const resolvedMinistry = await resolveMinistry(req.workspace._id, ministry);
    if (resolvedMinistry.error) {
      return res.status(resolvedMinistry.status).json({ message: resolvedMinistry.error });
    }
    if (!resolvedMinistry.unchanged) {
      transaction.ministry = resolvedMinistry.ministry ? resolvedMinistry.ministry._id : null;
    }

    //! Se anota si alguno de los dos no es el General (así se ve "Misiones → General")
    const fundLabel = (f) => (currentFund || nextFund ? fundName(f) : undefined);
    const before = transactionSnapshot(transaction, fundLabel(currentFund));

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
    if (!resolved.unchanged) transaction.fund = nextFund ? nextFund._id : null;
    if (!resolvedDonor.unchanged) {
      transaction.donor = resolvedDonor.donor ? resolvedDonor.donor._id : null;
    }
    if (!resolvedPayee.unchanged) {
      transaction.payee = resolvedPayee.payee ? resolvedPayee.payee._id : null;
    }
    if (paymentKind !== undefined) {
      const kind = paymentKind ? String(paymentKind) : null;
      if (kind && !isValidPaymentKind(kind)) {
        return res.status(400).json({ message: "Concepto de pago no válido" });
      }
      transaction.paymentKind = kind;
    }
    //! Un gasto nunca lleva aportante (p. ej. si se cambió de ingreso a gasto)
    if (transaction.type !== "income") transaction.donor = null;
    //! Un ingreso nunca lleva a quién se le pagó, ni concepto del pago
    if (transaction.type !== "expense") {
      transaction.payee = null;
      transaction.paymentKind = null;
    }
    //! El concepto del pago solo acompaña a un pago: sin persona no se guarda
    if (!transaction.payee) transaction.paymentKind = null;
    //! Y un ingreso nunca se carga a un ministerio: el presupuesto es de gasto
    if (transaction.type !== "expense") transaction.ministry = null;

    const updatedTransaction = await transaction.save();

    await audit(req, {
      action: "transaction.update",
      entity: "transaction",
      entityId: transaction._id,
      before,
      after: transactionSnapshot(updatedTransaction, fundLabel(nextFund)),
    });

    res.status(200).json(visible(req, updatedTransaction));
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

    res.status(200).json({ message: "Movimiento anulado", transaction: visible(req, transaction) });
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

    res.status(200).json({ message: "Movimiento restaurado", transaction: visible(req, transaction) });
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

    res.status(200).json(visible(req, transaction));
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

    res.status(200).json(visibleList(req, transactions));
  }),

  //! Balance general (con filtros opcionales)
  getBalance: asyncHandler(async (req, res) => {
    const { filters, error, status } = buildFilters(req.workspace._id, req.query, {
      puedeFiltrarPersonas: seesDonors(req),
    });
    if (error) return res.status(status || 400).json({ message: error });

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

  //! Ingresos y gastos de cada mes de un año (para el gráfico de barras). Los
  //! meses se cuentan en la zona horaria de quien pregunta: un movimiento del
  //! 31 a las 22:00 en Lima no debe caer en el mes siguiente.
  getYearByMonth: asyncHandler(async (req, res) => {
    const year = req.query.year === undefined ? new Date().getFullYear() : Number(req.query.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: "Año inválido" });
    }
    const timezone = String(req.query.tz || "UTC");
    try {
      new Intl.DateTimeFormat("es", { timeZone: timezone });
    } catch {
      return res.status(400).json({ message: "Zona horaria inválida" });
    }

    //! Rango holgado (un día a cada lado) y el año exacto se filtra ya en la zona.
    //! Como en el resto de cifras, el mes en curso solo cuenta hasta hoy.
    const rows = await Transaction.aggregate([
      {
        $match: upToToday({
          workspace: req.workspace._id,
          voided: { $ne: true },
          date: { $gte: new Date(Date.UTC(year - 1, 11, 31)), $lt: new Date(Date.UTC(year + 1, 0, 2)) },
        }),
      },
      {
        $addFields: {
          y: { $year: { date: "$date", timezone } },
          m: { $month: { date: "$date", timezone } },
        },
      },
      { $match: { y: year } },
      {
        $group: {
          _id: "$m",
          income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amountCents", 0] } },
          expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amountCents", 0] } },
        },
      },
    ]);

    const byMonth = new Map(rows.map((r) => [r._id, r]));
    const months = Array.from({ length: 12 }, (_, i) => {
      const row = byMonth.get(i + 1);
      return {
        month: i + 1,
        income: fromCents(row?.income || 0),
        expense: fromCents(row?.expense || 0),
      };
    });

    res.status(200).json({ year, months });
  }),

  //! Exportar a Excel respetando los filtros activos
  generateExcelReport: asyncHandler(async (req, res) => {
    const { filters, error, status } = buildFilters(req.workspace._id, req.query, {
      puedeFiltrarPersonas: seesDonors(req),
    });
    if (error) return res.status(status || 400).json({ message: error });

    const transactions = await Transaction.find(filters)
      .sort({ date: -1 })
      .populate("fund", "name")
      .populate("donor", "name")
      .populate("payee", "name");

    //! En una iglesia, cada ingreso lleva su tipo (diezmo, ofrenda…) según su
    //! categoría; si la categoría ya no existe, se deduce de su nombre
    const isChurch = req.workspace.kind === "iglesia";
    const kindByCategory = new Map();
    if (isChurch) {
      const categories = await Category.find({ workspace: req.workspace._id });
      categories.forEach((c) => kindByCategory.set(c.name, effectiveIncomeKind(c)));
    }
    const incomeKindOf = (tx) =>
      tx.type === "income"
        ? INCOME_KIND_LABELS[kindByCategory.get(tx.category) || inferIncomeKind(tx.category)]
        : "";

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transacciones");

    sheet.columns = [
      { header: "Fecha", key: "date", width: 15 },
      { header: "Tipo", key: "type", width: 10 },
      { header: "Categoría", key: "category", width: 20 },
      ...(isChurch ? [{ header: "Tipo de ingreso", key: "incomeKind", width: 18 }] : []),
      ...(seesDonors(req) ? [{ header: "Aportante", key: "donor", width: 24 }] : []),
      ...(seesDonors(req) ? [{ header: "Se le pagó a", key: "payee", width: 24 }] : []),
      ...(seesDonors(req) ? [{ header: "Concepto del pago", key: "paymentKind", width: 18 }] : []),
      { header: "Fondo", key: "fund", width: 18 },
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
        ...(isChurch ? { incomeKind: incomeKindOf(tx) } : {}),
        ...(seesDonors(req) ? { donor: tx.donor?.name || "" } : {}),
        ...(seesDonors(req) ? { payee: tx.payee?.name || "" } : {}),
        ...(seesDonors(req) ? { paymentKind: PAYMENT_KIND_LABELS[tx.paymentKind] || "" } : {}),
        fund: fundName(tx.fund),
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
