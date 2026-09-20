const mongoose = require("mongoose");
const Fund = require("../model/Fund");
const Transaction = require("../model/Transaccion");
const FundTransfer = require("../model/FundTransfer");
const { upToToday } = require("../utils/dates");

const GENERAL_NAME = "General";
const GENERAL_KEY = "general";

//! Nombre para mostrar (y para el historial): null es el fondo General
const fundName = (fund) => (fund ? fund.name : GENERAL_NAME);

//! Interpreta el fondo que manda el cliente:
//!   undefined            → no se tocó (devuelve { unchanged: true })
//!   null, "" o "general" → fondo General (fund: null)
//!   un id                → ese fondo, que debe ser de este espacio
//! Un fondo archivado no recibe movimientos nuevos, salvo que ya fuera el suyo
//! (`current`), para poder editar un movimiento viejo sin tener que moverlo,
//! o se pida `allowArchived` (sacar lo que le queda a un fondo archivado).
const resolveFund = async (workspaceId, value, { current = null, allowArchived = false } = {}) => {
  if (value === undefined) return { unchanged: true };
  if (value === null || value === "" || value === GENERAL_KEY) return { fund: null };

  if (!mongoose.isValidObjectId(value)) {
    return { error: "Fondo inválido", status: 400 };
  }
  const fund = await Fund.findOne({ _id: value, workspace: workspaceId });
  if (!fund) return { error: "Ese fondo no existe en este espacio", status: 404 };
  if (fund.archived && !allowArchived && String(current) !== String(fund._id)) {
    return { error: `El fondo "${fund.name}" está archivado`, status: 409 };
  }
  return { fund };
};

//! Totales en centavos por fondo (clave: id del fondo o "general"). No cuentan
//! los anulados ni lo que tiene fecha futura (todavía no pasó).
//! `until` corta antes de esa fecha: los informes de un mes o un año cerrado
//! necesitan el reparto que había AL CERRAR, no el de hoy.
const fundTotals = async (workspaceId, { until } = {}) => {
  const workspace = new mongoose.Types.ObjectId(String(workspaceId));
  const hasta = until ? { date: { $lt: until } } : {};
  const [movements, transfersOut, transfersIn] = await Promise.all([
    Transaction.aggregate([
      { $match: upToToday({ workspace, voided: { $ne: true }, ...hasta }) },
      {
        $group: {
          _id: { $ifNull: ["$fund", null] },
          income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amountCents", 0] } },
          expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amountCents", 0] } },
        },
      },
    ]),
    FundTransfer.aggregate([
      { $match: upToToday({ workspace, voided: { $ne: true }, ...hasta }) },
      { $group: { _id: { $ifNull: ["$from", null] }, cents: { $sum: "$amountCents" } } },
    ]),
    FundTransfer.aggregate([
      { $match: upToToday({ workspace, voided: { $ne: true }, ...hasta }) },
      { $group: { _id: { $ifNull: ["$to", null] }, cents: { $sum: "$amountCents" } } },
    ]),
  ]);

  const totals = new Map();
  const entry = (id) => {
    const key = id ? String(id) : GENERAL_KEY;
    if (!totals.has(key)) totals.set(key, { income: 0, expense: 0, transfersIn: 0, transfersOut: 0 });
    return totals.get(key);
  };
  movements.forEach((m) => Object.assign(entry(m._id), { income: m.income, expense: m.expense }));
  transfersOut.forEach((t) => { entry(t._id).transfersOut = t.cents; });
  transfersIn.forEach((t) => { entry(t._id).transfersIn = t.cents; });
  return totals;
};

module.exports = { GENERAL_NAME, GENERAL_KEY, fundName, resolveFund, fundTotals };
