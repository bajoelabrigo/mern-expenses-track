//! Las cifras de los informes mensual y anual. Un informe de tesorería no es
//! solo "cuánto entró y salió": lo que se lee en la iglesia es el saldo con el
//! que se abrió el periodo, lo que se movió y el saldo con el que se cierra.

const mongoose = require("mongoose");
const Transaction = require("../model/Transaccion");
const Category = require("../model/Category");
const Fund = require("../model/Fund");
const { fromCents } = require("../utils/money");
const { upToToday } = require("../utils/dates");
const { effectiveIncomeKind, inferIncomeKind } = require("../utils/incomeKinds");
const { GENERAL_NAME, fundTotals } = require("./fundService");

const oid = (id) => new mongoose.Types.ObjectId(String(id));

//! Un mes en la zona del espacio se aproxima con el día natural: los informes
//! son de meses cerrados, así que un desfase de horas no cambia el total.
const monthRange = (year, month) => ({
  from: new Date(Date.UTC(year, month - 1, 1)),
  to: new Date(Date.UTC(year, month, 1)),
});

const yearRange = (year) => ({
  from: new Date(Date.UTC(year, 0, 1)),
  to: new Date(Date.UTC(year + 1, 0, 1)),
});

//! Entró y salió en centavos dentro de un filtro de fechas
const totalsBetween = async (workspace, date) => {
  const [row] = await Transaction.aggregate([
    { $match: upToToday({ workspace, voided: { $ne: true }, date }) },
    {
      $group: {
        _id: null,
        income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amountCents", 0] } },
        expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amountCents", 0] } },
      },
    },
  ]);
  return { income: row?.income || 0, expense: row?.expense || 0 };
};

//! Lo que había en caja justo antes de `from`
const openingCents = async (workspace, from) => {
  const { income, expense } = await totalsBetween(workspace, { $lt: from });
  return income - expense;
};

//! Gastos agrupados por categoría, de mayor a menor
const expensesByCategory = async (workspace, date) => {
  const rows = await Transaction.aggregate([
    { $match: upToToday({ workspace, voided: { $ne: true }, type: "expense", date }) },
    { $group: { _id: "$category", cents: { $sum: "$amountCents" } } },
    { $sort: { cents: -1 } },
  ]);
  return rows.map((r) => ({ category: r._id, amount: fromCents(r.cents) }));
};

//! Ingresos agrupados por tipo de iglesia (diezmo, ofrenda…). El tipo vive en
//! la categoría; si no se eligió, se deduce del nombre.
const incomeByKind = async (workspace, date) => {
  const [rows, categories] = await Promise.all([
    Transaction.aggregate([
      { $match: upToToday({ workspace, voided: { $ne: true }, type: "income", date }) },
      { $group: { _id: "$category", cents: { $sum: "$amountCents" } } },
    ]),
    Category.find({ workspace }),
  ]);

  const kindOf = new Map(categories.map((c) => [c.name, effectiveIncomeKind(c)]));
  const byKind = new Map();
  rows.forEach(({ _id, cents }) => {
    const kind = kindOf.get(_id) || inferIncomeKind(_id);
    byKind.set(kind, (byKind.get(kind) || 0) + cents);
  });

  return [...byKind]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, cents]) => ({ kind, amount: fromCents(cents) }));
};

//! Ingresos por categoría, para los espacios personales (no hay "tipos")
const incomeByCategory = async (workspace, date) => {
  const rows = await Transaction.aggregate([
    { $match: upToToday({ workspace, voided: { $ne: true }, type: "income", date }) },
    { $group: { _id: "$category", cents: { $sum: "$amountCents" } } },
    { $sort: { cents: -1 } },
  ]);
  return rows.map((r) => ({ category: r._id, amount: fromCents(r.cents) }));
};

//! Cuántos gastos del periodo tienen comprobante guardado
const receiptCount = async (workspace, date) => {
  const [row] = await Transaction.aggregate([
    { $match: upToToday({ workspace, voided: { $ne: true }, type: "expense", date }) },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        withReceipt: { $sum: { $cond: [{ $ifNull: ["$receipt", false] }, 1, 0] } },
      },
    },
  ]);
  return { total: row?.total || 0, withReceipt: row?.withReceipt || 0 };
};

//! El saldo de cada fondo AL CERRAR el periodo, para que se vea cómo está
//! repartido el dinero (no solo cuánto hay). Tiene que ser al cierre y no el de
//! hoy: si no, en el informe de un mes viejo el reparto no sumaría el saldo.
const fundBalances = async (workspaceId, until) => {
  const [funds, totals] = await Promise.all([
    Fund.find({ workspace: workspaceId }).sort({ key: 1 }),
    fundTotals(workspaceId, { until }),
  ]);

  const saldo = (t = {}) =>
    fromCents((t.income || 0) - (t.expense || 0) + (t.transfersIn || 0) - (t.transfersOut || 0));

  const rows = [{ name: GENERAL_NAME, amount: saldo(totals.get("general")) }];
  funds.forEach((f) => {
    const amount = saldo(totals.get(String(f._id)));
    //! Un fondo archivado y vacío solo sería ruido en la hoja
    if (!f.archived || amount !== 0) rows.push({ name: f.name, amount });
  });
  return rows;
};

//! Las cifras comunes a los dos informes dentro de un rango
const periodFigures = async (workspaceId, { from, to }, isChurch) => {
  const workspace = oid(workspaceId);
  const date = { $gte: from, $lt: to };

  const [opening, totals, income, expenses, receipts] = await Promise.all([
    openingCents(workspace, from),
    totalsBetween(workspace, date),
    isChurch ? incomeByKind(workspace, date) : incomeByCategory(workspace, date),
    expensesByCategory(workspace, date),
    receiptCount(workspace, date),
  ]);

  const result = totals.income - totals.expense;
  return {
    opening: fromCents(opening),
    income: fromCents(totals.income),
    expense: fromCents(totals.expense),
    result: fromCents(result),
    closing: fromCents(opening + result),
    incomeBreakdown: income,
    expenseBreakdown: expenses,
    receipts,
  };
};

//! Informe de un mes
const monthlyReport = async (workspaceId, year, month, isChurch) => {
  const range = monthRange(year, month);
  const [figures, funds] = await Promise.all([
    periodFigures(workspaceId, range, isChurch),
    fundBalances(workspaceId, range.to),
  ]);
  return { year, month, ...figures, funds };
};

//! Informe de un año, con la tabla mes a mes
const annualReport = async (workspaceId, year, isChurch) => {
  const range = yearRange(year);
  const workspace = oid(workspaceId);

  const [figures, funds, rows] = await Promise.all([
    periodFigures(workspaceId, range, isChurch),
    fundBalances(workspaceId, range.to),
    Transaction.aggregate([
      {
        $match: upToToday({
          workspace,
          voided: { $ne: true },
          date: { $gte: range.from, $lt: range.to },
        }),
      },
      {
        $group: {
          _id: { $month: "$date" },
          income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amountCents", 0] } },
          expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amountCents", 0] } },
        },
      },
    ]),
  ]);

  const byMonth = new Map(rows.map((r) => [r._id, r]));
  //! Los doce meses siempre, aunque estén a cero: se lee como un calendario
  const months = Array.from({ length: 12 }, (_, i) => {
    const row = byMonth.get(i + 1);
    const income = row?.income || 0;
    const expense = row?.expense || 0;
    return {
      month: i + 1,
      income: fromCents(income),
      expense: fromCents(expense),
      result: fromCents(income - expense),
    };
  });

  return { year, ...figures, months, funds };
};

module.exports = { monthlyReport, annualReport, periodFigures, monthRange, yearRange };
