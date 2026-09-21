//! Cómo va el presupuesto de cada ministerio: cuánto tiene aprobado, cuánto
//! lleva gastado y cuánto le queda.

const mongoose = require("mongoose");
const Transaction = require("../model/Transaccion");
const Ministry = require("../model/Ministry");
const { fromCents } = require("../utils/money");
const { upToToday } = require("../utils/dates");

//! Avisos: al llegar al 80 % conviene mirar, al 100 % ya se pasó
const WARN_AT = 80;

//! Lo gastado por cada ministerio en un año (clave: id del ministerio).
//! Como el resto de cifras, no cuenta lo anulado ni lo que todavía no pasó.
const spentByMinistry = async (workspaceId, year) => {
  const rows = await Transaction.aggregate([
    {
      $match: upToToday({
        workspace: new mongoose.Types.ObjectId(String(workspaceId)),
        type: "expense",
        voided: { $ne: true },
        ministry: { $ne: null },
        date: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) },
      }),
    },
    { $group: { _id: "$ministry", cents: { $sum: "$amountCents" }, count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((r) => [String(r._id), { cents: r.cents, count: r.count }]));
};

//! Un ministerio con su avance. `spent` es lo gastado; `percent` va sobre el
//! presupuesto (si no hay presupuesto, no hay porcentaje que valga).
const withProgress = (ministry, spent = { cents: 0, count: 0 }) => {
  const budgetCents = ministry.budgetCents || 0;
  const remaining = budgetCents - spent.cents;
  const percent = budgetCents > 0 ? Math.round((spent.cents / budgetCents) * 100) : null;

  return {
    ...(typeof ministry.toJSON === "function" ? ministry.toJSON() : ministry),
    spent: fromCents(spent.cents),
    expenses: spent.count,
    remaining: fromCents(remaining),
    percent,
    //! Para que la pantalla no tenga que repetir estas reglas
    warning: percent !== null && percent >= WARN_AT && percent < 100,
    exceeded: percent !== null && percent >= 100,
  };
};

//! Los ministerios de un año con su avance. `leader` limita a los que lleva
//! esa persona, que es lo único que un líder puede ver.
const ministriesWithProgress = async (workspaceId, year, { leader } = {}) => {
  const filters = { workspace: workspaceId, year };
  if (leader) filters.leader = leader;

  const [ministries, spent] = await Promise.all([
    Ministry.find(filters).sort({ archived: 1, key: 1 }).populate("leader", "username email"),
    spentByMinistry(workspaceId, year),
  ]);

  return ministries.map((m) => withProgress(m, spent.get(String(m._id))));
};

module.exports = { ministriesWithProgress, spentByMinistry, withProgress, WARN_AT };
