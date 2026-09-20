const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const Fund = require("../model/Fund");
const FundTransfer = require("../model/FundTransfer");
const Transaction = require("../model/Transaccion");
const { toCents, fromCents } = require("../utils/money");
const { parseTransactionDate, upToToday } = require("../utils/dates");
const { audit, fundSnapshot } = require("../utils/audit");
const { can } = require("../utils/permissions");
const { buildFundReport, TRANSFER_LABEL } = require("../services/fundReportPdf");
const { fileSlug, sendPdf } = require("../services/pdfBits");
const { logoBytesFor } = require("../services/logoStorage");
const {
  GENERAL_NAME,
  GENERAL_KEY,
  fundName,
  resolveFund,
  fundTotals,
} = require("../services/fundService");

const MAX_GOAL_CENTS = 100_000_000_000;

//! Valida nombre, ícono, descripción y meta. Devuelve { values } o { error }.
//! En una edición solo se validan los campos que llegan.
const parseFundInput = (body, { partial = false } = {}) => {
  const values = {};

  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) return { error: "El nombre del fondo es obligatorio" };
    if (name.length > 60) return { error: "El nombre no puede superar los 60 caracteres" };
    if (name.toLowerCase() === GENERAL_KEY) {
      return { error: `"${GENERAL_NAME}" ya existe: es el fondo de todo lo que no tiene otro` };
    }
    values.name = name;
    values.key = name.toLowerCase();
  }

  if (body.icon !== undefined) values.icon = String(body.icon).trim().slice(0, 16) || "🏦";
  if (body.description !== undefined) {
    values.description = String(body.description).trim().slice(0, 200);
  }

  //! Meta: null o "" la quita
  if (body.goal !== undefined) {
    if (body.goal === null || body.goal === "") {
      values.goalCents = null;
    } else {
      const cents = toCents(body.goal);
      if (cents === null || cents <= 0) return { error: "La meta debe ser un monto positivo" };
      if (cents > MAX_GOAL_CENTS) return { error: "La meta es demasiado grande" };
      values.goalCents = cents;
    }
  }

  if (partial && body.archived !== undefined) values.archived = Boolean(body.archived);
  return { values };
};

//! Fondo del espacio actual por :id (nunca de otro)
const findInWorkspace = (req) => Fund.findOne({ _id: req.params.id, workspace: req.workspace._id });

//! Saldo y avance de un fondo a partir de sus totales (en unidades para la API)
const withBalance = (base, t = { income: 0, expense: 0, transfersIn: 0, transfersOut: 0 }) => {
  const balance = t.income - t.expense + t.transfersIn - t.transfersOut;
  //! Lo juntado para la meta: lo que entró (ingresos y pases recibidos); gastar
  //! del fondo no "des-junta" la campaña
  const raised = t.income + t.transfersIn;
  return {
    ...base,
    income: fromCents(t.income),
    expense: fromCents(t.expense),
    transfersIn: fromCents(t.transfersIn),
    transfersOut: fromCents(t.transfersOut),
    balance: fromCents(balance),
    raised: fromCents(raised),
  };
};

const duplicateName = (err) => err && err.code === 11000;

//! Datos del informe de un fondo: sus movimientos ordenados por fecha, los
//! pases recibidos como una entrada más, y los totales. Solo cuenta lo que ya
//! pasó y lo que no está anulado, como el resto de cifras de la app.
const buildReportData = async (workspaceId, fund, { withNames }) => {
  const fundFilter = fund ? fund._id : null;
  const [movements, transfersIn, transfersOut] = await Promise.all([
    Transaction.find(upToToday({ workspace: workspaceId, fund: fundFilter, voided: { $ne: true } }))
      .sort({ date: 1 })
      .populate("donor", "name"),
    FundTransfer.find(upToToday({ workspace: workspaceId, to: fundFilter, voided: { $ne: true } }))
      .sort({ date: 1 })
      .populate("from", "name"),
    FundTransfer.find(upToToday({ workspace: workspaceId, from: fundFilter, voided: { $ne: true } })),
  ]);

  const income = movements
    .filter((t) => t.type === "income")
    .map((t) => ({
      date: t.date,
      concept: t.description || t.category,
      category: t.category,
      donor: withNames && t.donor ? t.donor.name : "",
      amount: fromCents(t.amountCents),
    }));

  //! Un pase recibido también es dinero que llegó a la actividad
  transfersIn.forEach((t) => {
    income.push({
      date: t.date,
      concept: `${TRANSFER_LABEL} de ${t.from ? t.from.name : GENERAL_NAME}`,
      category: t.note || "",
      donor: "",
      amount: fromCents(t.amountCents),
    });
  });
  income.sort((a, b) => a.date - b.date);

  const expenses = movements
    .filter((t) => t.type === "expense")
    .map((t) => ({
      date: t.date,
      concept: t.description || t.category,
      category: t.category,
      receipt: Boolean(t.receipt),
      amount: fromCents(t.amountCents),
    }));

  const sum = (list) => list.reduce((total, item) => total + item.amount, 0);
  const movedOutCents = transfersOut.reduce((total, t) => total + t.amountCents, 0);
  const raised = sum(income);
  const spent = sum(expenses);
  const movedOut = fromCents(movedOutCents);

  return {
    info: fund
      ? { name: fund.name, description: fund.description, goal: fromCents(fund.goalCents || 0) || null }
      : { name: GENERAL_NAME, description: "Todo lo que no está en otro fondo", goal: null },
    report: {
      income,
      expenses,
      raised,
      spent,
      movedOut,
      balance: Number((raised - spent - movedOut).toFixed(2)),
      withReceipt: expenses.filter((e) => e.receipt).length,
    },
  };
};

const fundController = {
  //! Fondos del espacio con su saldo. El primero es siempre "General".
  list: asyncHandler(async (req, res) => {
    const [funds, totals] = await Promise.all([
      Fund.find({ workspace: req.workspace._id }).sort({ archived: 1, key: 1 }),
      fundTotals(req.workspace._id),
    ]);

    const general = withBalance(
      { _id: null, name: GENERAL_NAME, icon: "🏛️", description: "", goal: null, archived: false, general: true },
      totals.get(GENERAL_KEY)
    );
    const rest = funds.map((f) => withBalance({ ...f.toJSON(), general: false }, totals.get(String(f._id))));

    res.status(200).json([general, ...rest]);
  }),

  create: asyncHandler(async (req, res) => {
    const { values, error } = parseFundInput(req.body);
    if (error) return res.status(400).json({ message: error });

    let fund;
    try {
      fund = await Fund.create({ ...values, workspace: req.workspace._id, createdBy: req.user._id });
    } catch (err) {
      if (duplicateName(err)) {
        return res.status(409).json({ message: `Ya hay un fondo llamado "${values.name}"` });
      }
      throw err;
    }

    await audit(req, {
      action: "fund.create",
      entity: "fund",
      entityId: fund._id,
      after: fundSnapshot(fund),
    });

    res.status(201).json(withBalance({ ...fund.toJSON(), general: false }));
  }),

  update: asyncHandler(async (req, res) => {
    const fund = await findInWorkspace(req);
    if (!fund) return res.status(404).json({ message: "Fondo no encontrado" });

    const { values, error } = parseFundInput(req.body, { partial: true });
    if (error) return res.status(400).json({ message: error });

    const before = fundSnapshot(fund);
    Object.assign(fund, values);
    try {
      await fund.save();
    } catch (err) {
      if (duplicateName(err)) {
        return res.status(409).json({ message: `Ya hay un fondo llamado "${values.name}"` });
      }
      throw err;
    }

    const archivedChanged = before.archived !== fund.archived;
    await audit(req, {
      action: archivedChanged ? (fund.archived ? "fund.archive" : "fund.unarchive") : "fund.update",
      entity: "fund",
      entityId: fund._id,
      before,
      after: fundSnapshot(fund),
    });

    const totals = await fundTotals(req.workspace._id);
    res.status(200).json(withBalance({ ...fund.toJSON(), general: false }, totals.get(String(fund._id))));
  }),

  //! Informe de la actividad en PDF: lo que entró, en qué se gastó y qué quedó.
  //! Con ?nombres=1 sale quién dio cada aporte (solo si tiene permiso de verlo).
  report: asyncHandler(async (req, res) => {
    const { fund, error, status } = await resolveFund(req.workspace._id, req.params.id, {
      allowArchived: true,
    });
    if (error) return res.status(status).json({ message: error });

    const withNames = req.query.nombres === "1" && can(req.role, "donor:read");
    const [{ info, report }, logo] = await Promise.all([
      buildReportData(req.workspace._id, fund, { withNames }),
      logoBytesFor(req.workspace),
    ]);

    const doc = buildFundReport({
      workspace: req.workspace,
      fund: info,
      report,
      issuedBy: req.user.username,
      withNames,
      logo,
    });
    sendPdf(res, doc, `informe-${fileSlug(info.name)}-${new Date().getFullYear()}.pdf`);
  }),

  //! Solo se borra un fondo que nunca se usó; si tiene historia, se archiva
  delete: asyncHandler(async (req, res) => {
    const fund = await findInWorkspace(req);
    if (!fund) return res.status(404).json({ message: "Fondo no encontrado" });

    const [movements, transfers] = await Promise.all([
      Transaction.countDocuments({ workspace: req.workspace._id, fund: fund._id }),
      FundTransfer.countDocuments({
        workspace: req.workspace._id,
        $or: [{ from: fund._id }, { to: fund._id }],
      }),
    ]);
    if (movements + transfers > 0) {
      return res.status(409).json({
        message: "Este fondo ya tiene movimientos: archívalo en vez de borrarlo",
        code: "FUND_IN_USE",
      });
    }

    await fund.deleteOne();
    await audit(req, {
      action: "fund.delete",
      entity: "fund",
      entityId: fund._id,
      before: fundSnapshot(fund),
    });
    res.status(200).json({ message: "Fondo eliminado" });
  }),

  //! Pases entre fondos, los más recientes primero. `fund` filtra los que
  //! salen o entran a ese fondo ("general" para el General).
  listTransfers: asyncHandler(async (req, res) => {
    const filters = { workspace: req.workspace._id };
    const { fund, limit = 50 } = req.query;
    if (fund !== undefined && fund !== "") {
      if (fund === GENERAL_KEY) {
        filters.$or = [{ from: null }, { to: null }];
      } else if (mongoose.isValidObjectId(fund)) {
        filters.$or = [{ from: fund }, { to: fund }];
      } else {
        return res.status(400).json({ message: "Fondo inválido" });
      }
    }
    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

    const transfers = await FundTransfer.find(filters)
      .sort({ date: -1, createdAt: -1 })
      .limit(parsedLimit)
      .populate("from", "name icon")
      .populate("to", "name icon")
      .populate("createdBy", "username");

    res.status(200).json(transfers);
  }),

  createTransfer: asyncHandler(async (req, res) => {
    const { amount, date, note = "" } = req.body;

    //! "from"/"to" son obligatorios: null o "general" es el General, pero no
    //! mandarlos es un error (no se adivina de dónde sale el dinero)
    if (req.body.from === undefined || req.body.to === undefined) {
      return res.status(400).json({ message: "Indica de qué fondo sale y a cuál entra" });
    }
    //! De un archivado se puede sacar lo que le queda; a uno archivado no entra
    const from = await resolveFund(req.workspace._id, req.body.from, { allowArchived: true });
    if (from.error) return res.status(from.status).json({ message: from.error });
    const to = await resolveFund(req.workspace._id, req.body.to);
    if (to.error) return res.status(to.status).json({ message: to.error });

    const fromId = from.fund ? String(from.fund._id) : GENERAL_KEY;
    const toId = to.fund ? String(to.fund._id) : GENERAL_KEY;
    if (fromId === toId) {
      return res.status(400).json({ message: "El fondo de origen y el de destino son el mismo" });
    }

    const cents = toCents(amount);
    if (cents === null || cents <= 0) {
      return res.status(400).json({ message: "El monto debe ser un número positivo" });
    }
    if (cents > MAX_GOAL_CENTS) return res.status(400).json({ message: "El monto es demasiado grande" });

    const parsedDate = date ? parseTransactionDate(date) : new Date();
    if (!parsedDate) return res.status(400).json({ message: "Fecha inválida" });

    const transfer = await FundTransfer.create({
      workspace: req.workspace._id,
      from: from.fund ? from.fund._id : null,
      to: to.fund ? to.fund._id : null,
      amountCents: cents,
      date: parsedDate,
      note: String(note).trim().slice(0, 300),
      createdBy: req.user._id,
    });

    await audit(req, {
      action: "fund.transfer",
      entity: "fundTransfer",
      entityId: transfer._id,
      after: {
        from: fundName(from.fund),
        to: fundName(to.fund),
        amount: transfer.amount,
        date: transfer.date,
        note: transfer.note,
      },
    });

    await transfer.populate([
      { path: "from", select: "name icon" },
      { path: "to", select: "name icon" },
      { path: "createdBy", select: "username" },
    ]);
    res.status(201).json(transfer);
  }),

  //! Anular un pase: deja de contar, pero sigue a la vista con su motivo
  voidTransfer: asyncHandler(async (req, res) => {
    const transfer = await FundTransfer.findOne({
      _id: req.params.id,
      workspace: req.workspace._id,
    }).populate([
      { path: "from", select: "name" },
      { path: "to", select: "name" },
    ]);
    if (!transfer) return res.status(404).json({ message: "Pase no encontrado" });
    if (transfer.voided) return res.status(409).json({ message: "Este pase ya está anulado" });

    const reason = String(req.body?.reason || "").trim().slice(0, 300);
    if (!reason) return res.status(400).json({ message: "Escribe el motivo de la anulación" });

    transfer.voided = true;
    transfer.voidReason = reason;
    transfer.voidedAt = new Date();
    transfer.voidedBy = req.user._id;
    await transfer.save();

    await audit(req, {
      action: "fund.transfer.void",
      entity: "fundTransfer",
      entityId: transfer._id,
      before: { from: fundName(transfer.from), to: fundName(transfer.to), amount: transfer.amount, voided: false },
      after: { voided: true, voidReason: reason },
      note: reason,
    });

    res.status(200).json(transfer);
  }),
};

module.exports = fundController;
//! Se exporta para poder comprobar en las pruebas lo que dirá el informe
module.exports.buildReportData = buildReportData;
