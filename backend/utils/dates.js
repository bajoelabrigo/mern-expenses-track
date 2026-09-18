//! Utilidades de fechas compartidas por los controladores.
//!
//! Ojo: new Date("2025-06-10") se interpreta como UTC, así que en zonas con
//! desfase negativo (América) cae en el día anterior. Por eso las fechas con
//! formato YYYY-MM-DD se construyen explícitamente en hora local.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const buildLocalDate = (value, endOfDay) => {
  const [year, month, day] = value.split("-").map(Number);
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
};

//! Devuelve null si no hay valor y undefined si la fecha es inválida.
const parseDate = (value, endOfDay) => {
  if (!value) return null;

  if (typeof value === "string" && DATE_ONLY.test(value.trim())) {
    const local = buildLocalDate(value.trim(), endOfDay);
    return Number.isNaN(local.getTime()) ? undefined : local;
  }

  //! Si viene una marca de tiempo completa se respeta tal cual
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const parseStartDate = (value) => parseDate(value, false);

//! "hasta el 10 de junio" debe incluir todo ese día (23:59:59.999 local)
const parseEndDate = (value) => parseDate(value, true);

//! Rango por defecto según el período solicitado.
const getPeriodRange = (period, today = new Date()) => {
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  const monthsBack = {
    monthly: 0,
    bimonthly: 1,
    quarterly: 2,
    semiannual: 5,
    annual: 11,
  };

  if (!(period in monthsBack)) return null;

  const start = new Date(
    today.getFullYear(),
    today.getMonth() - monthsBack[period],
    1
  );
  start.setHours(0, 0, 0, 0);

  return { start, end: endOfToday };
};

module.exports = { parseStartDate, parseEndDate, getPeriodRange };
