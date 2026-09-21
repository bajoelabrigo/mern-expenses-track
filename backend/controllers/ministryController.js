const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const Ministry = require("../model/Ministry");
const Transaction = require("../model/Transaccion");
const Membership = require("../model/Membership");
const { toCents, fromCents } = require("../utils/money");
const { upToToday } = require("../utils/dates");
const { audit } = require("../utils/audit");
const { can } = require("../utils/permissions");
const { ministriesWithProgress } = require("../services/ministryService");

const MAX_BUDGET_CENTS = 100_000_000_000;

const parseYear = (value) => {
  const year = value === undefined ? new Date().getFullYear() : Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
};

//! Valida nombre, presupuesto, ícono y líder
const parseInput = async (req, { partial = false } = {}) => {
  const body = req.body || {};
  const values = {};

  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) return { error: "El nombre del ministerio es obligatorio" };
    if (name.length > 60) return { error: "El nombre no puede superar los 60 caracteres" };
    values.name = name;
    values.key = name.toLowerCase();
  }

  if (!partial || body.budget !== undefined) {
    const cents = toCents(body.budget);
    if (cents === null || cents < 0) return { error: "El presupuesto debe ser un monto válido" };
    if (cents > MAX_BUDGET_CENTS) return { error: "El presupuesto es demasiado grande" };
    values.budgetCents = cents;
  }

  if (body.icon !== undefined) values.icon = String(body.icon).trim().slice(0, 16) || "🙌";
  if (partial && body.archived !== undefined) values.archived = Boolean(body.archived);

  //! El líder tiene que ser miembro de este espacio: si no, se le estaría
  //! dando acceso a alguien de fuera
  if (body.leader !== undefined) {
    if (body.leader === null || body.leader === "") {
      values.leader = null;
    } else {
      if (!mongoose.isValidObjectId(body.leader)) return { error: "Líder inválido" };
      const membership = await Membership.findOne({
        workspace: req.workspace._id,
        user: body.leader,
      });
      if (!membership) {
        return { error: "Esa persona no es miembro de este espacio" };
      }
      values.leader = membership.user;
    }
  }

  return { values };
};

const findInWorkspace = (req) =>
  Ministry.findOne({ _id: req.params.id, workspace: req.workspace._id });

const duplicate = (err) => err && err.code === 11000;

const ministryController = {
  //! Los ministerios del año con su avance. Un líder solo ve los suyos.
  list: asyncHandler(async (req, res) => {
    const year = parseYear(req.query.year);
    if (year === null) return res.status(400).json({ message: "Año inválido" });

    const soloMios = !can(req.role, "ministry:read");
    const ministries = await ministriesWithProgress(req.workspace._id, year, {
      leader: soloMios ? req.user._id : undefined,
    });

    res.json({ year, ministries, currency: req.workspace.currency });
  }),

  //! Los gastos cargados a un ministerio. Un líder solo alcanza el suyo: es
  //! lo único del libro que puede ver.
  expenses: asyncHandler(async (req, res) => {
    const ministry = await findInWorkspace(req);
    if (!ministry) return res.status(404).json({ message: "Ese ministerio no existe" });

    const esSuyo = ministry.leader && String(ministry.leader) === String(req.user._id);
    if (!can(req.role, "ministry:read") && !esSuyo) {
      return res.status(403).json({ message: "Solo puedes ver el ministerio que llevas" });
    }

    const expenses = await Transaction.find(
      upToToday({
        workspace: req.workspace._id,
        ministry: ministry._id,
        type: "expense",
        voided: { $ne: true },
        date: {
          $gte: new Date(Date.UTC(ministry.year, 0, 1)),
          $lt: new Date(Date.UTC(ministry.year + 1, 0, 1)),
        },
      })
    )
      .sort({ date: -1 })
      .limit(200)
      .select("date category description amountCents receipt")
      .populate("createdBy", "username");

    res.json(
      expenses.map((t) => ({
        _id: t._id,
        date: t.date,
        category: t.category,
        description: t.description,
        amount: fromCents(t.amountCents),
        //! Solo si lo tiene: el líder no puede abrir comprobantes ajenos
        hasReceipt: Boolean(t.receipt),
      }))
    );
  }),

  create: asyncHandler(async (req, res) => {
    const year = parseYear(req.body?.year);
    if (year === null) return res.status(400).json({ message: "Año inválido" });

    const { values, error } = await parseInput(req);
    if (error) return res.status(400).json({ message: error });

    let ministry;
    try {
      ministry = await Ministry.create({
        ...values,
        year,
        workspace: req.workspace._id,
        createdBy: req.user._id,
      });
    } catch (err) {
      if (duplicate(err)) {
        return res.status(409).json({
          message: `Ya hay un ministerio llamado "${values.name}" en ${year}`,
        });
      }
      throw err;
    }

    await audit(req, {
      action: "ministry.create",
      entity: "ministry",
      entityId: ministry._id,
      after: { name: ministry.name, year, budget: ministry.budget },
    });

    res.status(201).json(ministry.toJSON());
  }),

  update: asyncHandler(async (req, res) => {
    const ministry = await findInWorkspace(req);
    if (!ministry) return res.status(404).json({ message: "Ese ministerio no existe" });

    const { values, error } = await parseInput(req, { partial: true });
    if (error) return res.status(400).json({ message: error });

    const before = { name: ministry.name, budget: ministry.budget, archived: ministry.archived };
    Object.assign(ministry, values);
    try {
      await ministry.save();
    } catch (err) {
      if (duplicate(err)) {
        return res.status(409).json({ message: `Ya hay un ministerio con ese nombre en ${ministry.year}` });
      }
      throw err;
    }

    await audit(req, {
      action: "ministry.update",
      entity: "ministry",
      entityId: ministry._id,
      before,
      after: { name: ministry.name, budget: ministry.budget, archived: ministry.archived },
    });

    res.json(ministry.toJSON());
  }),

  //! Solo se borra un ministerio al que nunca se le cargó nada
  delete: asyncHandler(async (req, res) => {
    const ministry = await findInWorkspace(req);
    if (!ministry) return res.status(404).json({ message: "Ese ministerio no existe" });

    const usado = await Transaction.countDocuments({ ministry: ministry._id });
    if (usado > 0) {
      return res.status(409).json({
        message: "Ese ministerio ya tiene gastos: archívalo en vez de borrarlo",
        code: "MINISTRY_IN_USE",
      });
    }

    await ministry.deleteOne();
    await audit(req, {
      action: "ministry.delete",
      entity: "ministry",
      entityId: ministry._id,
      before: { name: ministry.name, year: ministry.year },
    });

    res.json({ message: "Ministerio borrado" });
  }),
};

module.exports = ministryController;
