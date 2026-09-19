import { toCents } from "../../lib/money";
import { toISODate } from "../../lib/periods";

//! Agrupa por día, con el neto de cada día (los anulados no suman)
export const groupByDay = (transactions) => {
  const groups = [];
  const index = new Map();
  transactions.forEach((t) => {
    const key = toISODate(new Date(t.date));
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ key, date: t.date, items: [], net: 0 });
    }
    const group = groups[index.get(key)];
    group.items.push(t);
    if (!t.voided) group.net += toCents(t.amount) * (t.type === "income" ? 1 : -1);
  });
  return groups;
};
