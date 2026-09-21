const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const Donor = require("../model/Donor");
const Transaction = require("../model/Transaccion");
const { fromCents } = require("../utils/money");
const { audit } = require("../utils/audit");
const Category = require("../model/Category");
const { effectiveIncomeKind, inferIncomeKind } = require("../utils/incomeKinds");
const { PAYMENT_KIND_LABELS } = require("../utils/paymentKinds");
const { buildStatements, buildPaymentStatements, fileSlug } = require("../services/statementPdf");
const { logoBytesFor } = require("../services/logoStorage");
const { upToToday } = require("../utils/dates");

//! Lo que se guarda en el historial de un aportante (sin montos: el historial
//! lo leen roles que no ven cuánto dio cada quien; por eso además estas
//! entradas se filtran por entidad en listAudit)
const donorSnapshot = (donor) =>
  donor && {
    name: donor.name,
    document: donor.document,
    email: donor.email,
    phone: donor.phone,
    member: donor.member,
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
  //! ¿Es miembro de la congregación? Solo informativo, para los informes
  if (body.member !== undefined) values.member = Boolean(body.member);
  return { values };
};

//! Cuánto dio cada aportante en un año (clave: id). No cuentan los anulados ni
//! lo que tenga fecha futura: una constancia dice lo que ya se recibió.
const donorTotals = async (workspaceId, year) => {
  const rows = await Transaction.aggregate([
    {
      $match: upToToday({
        workspace: new mongoose.Types.ObjectId(String(workspaceId)),
        type: "income",
        voided: { $ne: true },
        donor: { $ne: null },
        ...(year
          ? { date: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) } }
          : {}),
      }),
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

//! Cuánto se le pagó a cada persona en un año (clave: id). Mismo criterio: no
//! cuentan los anulados ni lo que tenga fecha futura.
const paidTotals = async (workspaceId, year) => {
  const rows = await Transaction.aggregate([
    {
      $match: upToToday({
        workspace: new mongoose.Types.ObjectId(String(workspaceId)),
        type: "expense",
        voided: { $ne: true },
        payee: { $ne: null },
        ...(year
          ? { date: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) } }
          : {}),
      }),
    },
    {
      $group: {
        _id: "$payee",
        cents: { $sum: "$amountCents" },
        count: { $sum: 1 },
        last: { $max: "$date" },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
};

const withTotals = (donor, row, paid) => ({
  ...donor.toJSON(),
  given: fromCents(row?.cents || 0),
  gifts: row?.count || 0,
  lastGift: row?.last || null,
  paid: fromCents(paid?.cents || 0),
  payments: paid?.count || 0,
  lastPayment: paid?.last || null,
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
  const match = upToToday({
    workspace: new mongoose.Types.ObjectId(String(workspaceId)),
    type: "income",
    voided: { $ne: true },
    donor: donorIds ? { $in: donorIds.map((id) => new mongoose.Types.ObjectId(String(id))) } : { $ne: null },
    date: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) },
  });

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

//! Lo PAGADO en el año a cada persona, por concepto y por mes: es lo que lleva
//! la constancia de pagos. Mismo criterio que los aportes: sin anulados y solo
//! hasta hoy.
const paymentSummaries = async (workspaceId, year, personIds) => {
  const match = upToToday({
    workspace: new mongoose.Types.ObjectId(String(workspaceId)),
    type: "expense",
    voided: { $ne: true },
    payee: personIds
      ? { $in: personIds.map((id) => new mongoose.Types.ObjectId(String(id))) }
      : { $ne: null },
    date: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) },
  });

  const rows = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: { payee: "$payee", kind: "$paymentKind", month: { $month: "$date" } },
        cents: { $sum: "$amountCents" },
      },
    },
  ]);

  const summaries = new Map();
  rows.forEach(({ _id, cents }) => {
    const key = String(_id.payee);
    if (!summaries.has(key)) summaries.set(key, { total: 0, kinds: new Map(), months: new Map() });
    const summary = summaries.get(key);
    const kind = _id.kind || "otro";
    summary.total += cents;
    summary.kinds.set(kind, (summary.kinds.get(kind) || 0) + cents);
    summary.months.set(_id.month, (summary.months.get(_id.month) || 0) + cents);
  });

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

const donorController = {
  //! Personas con lo que dio y lo que recibió en el año pedido
  list: asyncHandler(async (req, res) => {
    const year = parseYear(req.query.year);
    if (year === null) return res.status(400).json({ message: "Año inválido" });

    const [donors, totals, paid] = await Promise.all([
      Donor.find({ workspace: req.workspace._id }).sort({ archived: 1, key: 1 }),
      donorTotals(req.workspace._id, year),
      paidTotals(req.workspace._id, year),
    ]);

    res.status(200).json({
      year,
      donors: donors.map((d) => withTotals(d, totals.get(String(d._id)), paid.get(String(d._id)))),
    });
  }),

  getOne: asyncHandler(async (req, res) => {
    const donor = await findInWorkspace(req);
    if (!donor) return res.status(404).json({ message: "Aportante no encontrado" });

    const year = parseYear(req.query.year);
    if (year === null) return res.status(400).json({ message: "Año inválido" });

    const [totals, allTime, paid, paidAll] = await Promise.all([
      donorTotals(req.workspace._id, year),
      donorTotals(req.workspace._id, null),
      paidTotals(req.workspace._id, year),
      paidTotals(req.workspace._id, null),
    ]);
    const all = allTime.get(String(donor._id));
    const allPaid = paidAll.get(String(donor._id));

    res.status(200).json({
      year,
      ...withTotals(donor, totals.get(String(donor._id)), paid.get(String(donor._id))),
      givenAllTime: fromCents(all?.cents || 0),
      giftsAllTime: all?.count || 0,
      paidAllTime: fromCents(allPaid?.cents || 0),
      paymentsAllTime: allPaid?.count || 0,
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
      logo: await logoBytesFor(req.workspace),
    });
    sendPdf(res, doc, `constancia-${fileSlug(donor.name)}-${year}.pdf`);
  }),

  //! Todas las constancias del año en un solo PDF, una por página
  statements: asyncHandler(async (req, res) => {    const year = parseYear(req.query.year);
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
      logo: await logoBytesFor(req.workspace),
    });
    sendPdf(res, doc, `constancias-${fileSlug(req.workspace.name)}-${year}.pdf`);
  }),

  //! Constancia anual de PAGOS de una persona (PDF): lo que la iglesia le pagó,
  //! con línea de "Recibí conforme" para que la firme
  paymentStatement: asyncHandler(async (req, res) => {
    const person = await findInWorkspace(req);
    if (!person) return res.status(404).json({ message: "Persona no encontrada" });

    const year = parseYear(req.query.year);
    if (year === null) return res.status(400).json({ message: "Año inválido" });

    const summaries = await paymentSummaries(req.workspace._id, year, [person._id]);
    const summary = summaries.get(String(person._id));
    if (!summary) {
      return res.status(409).json({
        message: `${person.name} no tiene pagos registrados en ${year}`,
        code: "NO_PAYMENTS",
      });
    }

    const doc = buildPaymentStatements({
      workspace: req.workspace,
      year,
      issuedBy: req.user.username,
      statements: [{ person, summary }],
      logo: await logoBytesFor(req.workspace),
    });
    sendPdf(res, doc, `constancia-pagos-${fileSlug(person.name)}-${year}.pdf`);
  }),

  //! Todas las constancias de pago del año en un solo PDF, una por página
  paymentStatements: asyncHandler(async (req, res) => {
    const year = parseYear(req.query.year);
    if (year === null) return res.status(400).json({ message: "Año inválido" });

    const [people, summaries] = await Promise.all([
      Donor.find({ workspace: req.workspace._id }).sort({ key: 1 }),
      paymentSummaries(req.workspace._id, year),
    ]);

    const statements = people
      .filter((person) => summaries.has(String(person._id)))
      .map((person) => ({ person, summary: summaries.get(String(person._id)) }));

    if (statements.length === 0) {
      return res.status(409).json({
        message: `No hay pagos a personas registrados en ${year}`,
        code: "NO_PAYMENTS",
      });
    }

    const doc = buildPaymentStatements({
      workspace: req.workspace,
      year,
      issuedBy: req.user.username,
      statements,
      logo: await logoBytesFor(req.workspace),
    });
    sendPdf(res, doc, `constancias-pagos-${fileSlug(req.workspace.name)}-${year}.pdf`);
  }),

  //! Informe de pagos a personas del año: total, a quién, por concepto y qué
  //! parte del gasto se fue en pagos a personas. Lo usa la pantalla de Informes.
  paymentsReport: asyncHandler(async (req, res) => {
    const year = parseYear(req.query.year);
    if (year === null) return res.status(400).json({ message: "Año inválido" });

    const workspaceId = req.workspace._id;
    const [people, summaries, expenseRows] = await Promise.all([
      Donor.find({ workspace: workspaceId }).select("name member").lean(),
      paymentSummaries(workspaceId, year),
      Transaction.aggregate([
        {
          $match: upToToday({
            workspace: new mongoose.Types.ObjectId(String(workspaceId)),
            type: "expense",
            voided: { $ne: true },
            date: {
              $gte: new Date(Date.UTC(year, 0, 1)),
              $lt: new Date(Date.UTC(year + 1, 0, 1)),
            },
          }),
        },
        { $group: { _id: null, cents: { $sum: "$amountCents" } } },
      ]),
    ]);

    const porId = new Map(people.map((p) => [String(p._id), p]));
    let totalCents = 0;
    const kinds = new Map();

    const lista = [...summaries].map(([id, s]) => {
      const person = porId.get(id);
      totalCents += Math.round(s.total * 100);
      s.byKind.forEach((k) =>
        kinds.set(k.kind, (kinds.get(k.kind) || 0) + Math.round(k.amount * 100))
      );
      return {
        _id: id,
        name: person?.name || "",
        member: Boolean(person?.member),
        amount: s.total,
        concepts: s.byKind.length,
      };
    });

    //! Cuántos pagos hubo (movimientos, no personas)
    const countRows = await Transaction.aggregate([
      {
        $match: upToToday({
          workspace: new mongoose.Types.ObjectId(String(workspaceId)),
          type: "expense",
          voided: { $ne: true },
          payee: { $ne: null },
          date: {
            $gte: new Date(Date.UTC(year, 0, 1)),
            $lt: new Date(Date.UTC(year + 1, 0, 1)),
          },
        }),
      },
      { $count: "n" },
    ]);

    const expenseCents = expenseRows[0]?.cents || 0;
    const total = fromCents(totalCents);

    res.status(200).json({
      year,
      total,
      payments: countRows[0]?.n || 0,
      people: lista.sort((a, b) => b.amount - a.amount),
      byKind: [...kinds]
        .sort((a, b) => b[1] - a[1])
        .map(([kind, cents]) => ({
          kind,
          label: PAYMENT_KIND_LABELS[kind] || PAYMENT_KIND_LABELS.otro,
          amount: fromCents(cents),
        })),
      expenseTotal: fromCents(expenseCents),
      share: expenseCents > 0 ? Math.round((totalCents / expenseCents) * 1000) / 10 : 0,
    });
  }),

  //! Solo se borra a quien no tiene ningún movimiento; si ya dio o recibió, se
  //! archiva (sus datos hacen falta para las constancias)
  delete: asyncHandler(async (req, res) => {
    const donor = await findInWorkspace(req);
    if (!donor) return res.status(404).json({ message: "Aportante no encontrado" });

    const [gifts, pagos] = await Promise.all([
      Transaction.countDocuments({ workspace: req.workspace._id, donor: donor._id }),
      Transaction.countDocuments({ workspace: req.workspace._id, payee: donor._id }),
    ]);
    if (gifts + pagos > 0) {
      return res.status(409).json({
        message:
          "Esta persona ya tiene aportes o pagos registrados: archívala en vez de borrarla",
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
module.exports.paidTotals = paidTotals;
//! Se exportan para poder comprobar en las pruebas lo que dirán las constancias
module.exports.statementSummaries = statementSummaries;
module.exports.paymentSummaries = paymentSummaries;
