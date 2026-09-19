const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const Donor = require("../model/Donor");
const Transaction = require("../model/Transaccion");
const { fromCents } = require("../utils/money");
const { audit } = require("../utils/audit");
const Category = require("../model/Category");
const { effectiveIncomeKind, inferIncomeKind } = require("../utils/incomeKinds");
const { buildStatements, fileSlug } = require("../services/statementPdf");

//! Lo que se guarda en el historial de un aportante (sin montos: el historial
//! lo leen roles que no ven cuánto dio cada quien; por eso además estas
//! entradas se filtran por entidad en listAudit)
const donorSnapshot = (donor) =>
  donor && {
    name: donor.name,
    document: donor.document,
    email: donor.email,
    phone: donor.phone,
    archived: donor.archived,
  };

const parseDonorInput = (body, { partial = false } = {}) => {
  const values = {};

  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) return { error: "El nombre del aportante es obligatorio" };
    if (name.length > 80) return { error: "El nombre no puede superar los 80 caracteres" };
    values.name = name;
    values.key = name.toLowerCase();
  }

  const text = (field, max) => {
    if (body[field] === undefined) return;
    values[field] = String(body[field]).trim().slice(0, max);
  };
  text("document", 20);
  text("phone", 30);
  text("notes", 300);
  if (body.email !== undefined) values.email = String(body.email).trim().toLowerCase().slice(0, 120);

  if (partial && body.archived !== undefined) values.archived = Boolean(body.archived);
  return { values };
};

//! Cuánto dio cada aportante en un año (clave: id). Los anulados no cuentan.
const donorTotals = async (workspaceId, year) => {
  const rows = await Transaction.aggregate([
    {
      $match: {
        workspace: new mongoose.Types.ObjectId(String(workspaceId)),
        type: "income",
        voided: { $ne: true },
        donor: { $ne: null },
        ...(year
          ? { date: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) } }
          : {}),
      },
    },
    {
      $group: {
        _id: "$donor",
        cents: { $sum: "$amountCents" },
        count: { $sum: 1 },
        last: { $max: "$date" },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
};

const withTotals = (donor, row) => ({
  ...donor.toJSON(),
  given: fromCents(row?.cents || 0),
  gifts: row?.count || 0,
  lastGift: row?.last || null,
});

const parseYear = (value) => {
  if (value === undefined || value === "") return new Date().getFullYear();
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
};

const findInWorkspace = (req) => Donor.findOne({ _id: req.params.id, workspace: req.workspace._id });

//! Lo aportado en el año por cada persona, repartido por tipo y por mes: es lo
//! que lleva la constancia. Clave del mapa: id del aportante.
const statementSummaries = async (workspaceId, year, donorIds) => {
  const match = {
    workspace: new mongoose.Types.ObjectId(String(workspaceId)),
    type: "income",
    voided: { $ne: true },
    donor: donorIds ? { $in: donorIds.map((id) => new mongoose.Types.ObjectId(String(id))) } : { $ne: null },
    date: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) },
  };

  const [rows, categories] = await Promise.all([
    Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: { donor: "$donor", category: "$category", month: { $month: "$date" } },
          cents: { $sum: "$amountCents" },
        },
      },
    ]),
    Category.find({ workspace: workspaceId }),
  ]);

  const kindOf = new Map(categories.map((c) => [c.name, effectiveIncomeKind(c)]));
  const summaries = new Map();

  rows.forEach(({ _id, cents }) => {
    const key = String(_id.donor);
    if (!summaries.has(key)) summaries.set(key, { total: 0, kinds: new Map(), months: new Map() });
    const summary = summaries.get(key);
    const kind = kindOf.get(_id.category) || inferIncomeKind(_id.category);
    summary.total += cents;
    summary.kinds.set(kind, (summary.kinds.get(kind) || 0) + cents);
    summary.months.set(_id.month, (summary.months.get(_id.month) || 0) + cents);
  });

  //! A unidades y en orden (los tipos por monto, los meses por calendario)
  return new Map(
    [...summaries].map(([key, s]) => [
      key,
      {
        total: fromCents(s.total),
        byKind: [...s.kinds]
          .sort((a, b) => b[1] - a[1])
          .map(([kind, cents]) => ({ kind, amount: fromCents(cents) })),
        byMonth: [...s.months]
          .sort((a, b) => a[0] - b[0])
          .map(([month, cents]) => ({ month, amount: fromCents(cents) })),
      },
    ])
  );
};

//! Envía el PDF ya armado con el nombre de archivo indicado
const sendPdf = (res, doc, filename) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  doc.pipe(res);
};

const donorController = {
  //! Aportantes con lo que dio cada uno en el año pedido
  list: asyncHandler(async (req, res) => {
    const year = parseYear(req.query.year);
    if (year === null) return res.status(400).json({ message: "Año inválido" });

    const [donors, totals] = await Promise.all([
      Donor.find({ workspace: req.workspace._id }).sort({ archived: 1, key: 1 }),
      donorTotals(req.workspace._id, year),
    ]);

    res.status(200).json({
      year,
      donors: donors.map((d) => withTotals(d, totals.get(String(d._id)))),
    });
  }),

  getOne: asyncHandler(async (req, res) => {
    const donor = await findInWorkspace(req);
    if (!donor) return res.status(404).json({ message: "Aportante no encontrado" });

    const year = parseYear(req.query.year);
    if (year === null) return res.status(400).json({ message: "Año inválido" });

    const [totals, allTime] = await Promise.all([
      donorTotals(req.workspace._id, year),
      donorTotals(req.workspace._id, null),
    ]);
    const all = allTime.get(String(donor._id));

    res.status(200).json({
      year,
      ...withTotals(donor, totals.get(String(donor._id))),
      givenAllTime: fromCents(all?.cents || 0),
      giftsAllTime: all?.count || 0,
    });
  }),

  create: asyncHandler(async (req, res) => {
    const { values, error } = parseDonorInput(req.body);
    if (error) return res.status(400).json({ message: error });

    let donor;
    try {
      donor = await Donor.create({ ...values, workspace: req.workspace._id, createdBy: req.user._id });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          message: `Ya hay un aportante llamado "${values.name}". Si son dos personas distintas, añade algo que las diferencie.`,
          code: "DONOR_EXISTS",
        });
      }
      throw err;
    }

    await audit(req, {
      action: "donor.create",
      entity: "donor",
      entityId: donor._id,
      after: donorSnapshot(donor),
    });

    res.status(201).json(withTotals(donor));
  }),

  update: asyncHandler(async (req, res) => {
    const donor = await findInWorkspace(req);
    if (!donor) return res.status(404).json({ message: "Aportante no encontrado" });

    const { values, error } = parseDonorInput(req.body, { partial: true });
    if (error) return res.status(400).json({ message: error });

    const before = donorSnapshot(donor);
    Object.assign(donor, values);
    try {
      await donor.save();
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ message: `Ya hay un aportante llamado "${values.name}"` });
      }
      throw err;
    }

    const archivedChanged = before.archived !== donor.archived;
    await audit(req, {
      action: archivedChanged ? (donor.archived ? "donor.archive" : "donor.unarchive") : "donor.update",
      entity: "donor",
      entityId: donor._id,
      before,
      after: donorSnapshot(donor),
    });

    const totals = await donorTotals(req.workspace._id, new Date().getFullYear());
    res.status(200).json(withTotals(donor, totals.get(String(donor._id))));
  }),

  //! Constancia anual de una persona (PDF)
  statement: asyncHandler(async (req, res) => {
    const donor = await findInWorkspace(req);
    if (!donor) return res.status(404).json({ message: "Aportante no encontrado" });

    const year = parseYear(req.query.year);
    if (year === null) return res.status(400).json({ message: "Año inválido" });

    const summaries = await statementSummaries(req.workspace._id, year, [donor._id]);
    const summary = summaries.get(String(donor._id));
    if (!summary) {
      return res.status(409).json({
        message: `${donor.name} no tiene aportes registrados en ${year}`,
        code: "NO_GIFTS",
      });
    }

    const doc = buildStatements({
      workspace: req.workspace,
      year,
      issuedBy: req.user.username,
      statements: [{ donor, summary }],
    });
    sendPdf(res, doc, `constancia-${fileSlug(donor.name)}-${year}.pdf`);
  }),

  //! Todas las constancias del año en un solo PDF, una por página
  statements: asyncHandler(async (req, res) => {
    const year = parseYear(req.query.year);
    if (year === null) return res.status(400).json({ message: "Año inválido" });

    const [donors, summaries] = await Promise.all([
      Donor.find({ workspace: req.workspace._id }).sort({ key: 1 }),
      statementSummaries(req.workspace._id, year),
    ]);

    //! Solo quienes aportaron ese año (incluidos los archivados: también les
    //! toca su constancia)
    const statements = donors
      .filter((donor) => summaries.has(String(donor._id)))
      .map((donor) => ({ donor, summary: summaries.get(String(donor._id)) }));

    if (statements.length === 0) {
      return res.status(409).json({
        message: `No hay aportes registrados en ${year}`,
        code: "NO_GIFTS",
      });
    }

    const doc = buildStatements({
      workspace: req.workspace,
      year,
      issuedBy: req.user.username,
      statements,
    });
    sendPdf(res, doc, `constancias-${fileSlug(req.workspace.name)}-${year}.pdf`);
  }),

  //! Solo se borra a quien no tiene ningún aporte; si ya dio, se archiva (sus
  //! datos hacen falta para las constancias)
  delete: asyncHandler(async (req, res) => {
    const donor = await findInWorkspace(req);
    if (!donor) return res.status(404).json({ message: "Aportante no encontrado" });

    const gifts = await Transaction.countDocuments({
      workspace: req.workspace._id,
      donor: donor._id,
    });
    if (gifts > 0) {
      return res.status(409).json({
        message: "Este aportante ya tiene aportes registrados: archívalo en vez de borrarlo",
        code: "DONOR_IN_USE",
      });
    }

    await donor.deleteOne();
    await audit(req, {
      action: "donor.delete",
      entity: "donor",
      entityId: donor._id,
      before: donorSnapshot(donor),
    });
    res.status(200).json({ message: "Aportante eliminado" });
  }),
};

module.exports = donorController;
module.exports.donorTotals = donorTotals;
//! Se exporta para poder comprobar en las pruebas lo que dirá la constancia
module.exports.statementSummaries = statementSummaries;
