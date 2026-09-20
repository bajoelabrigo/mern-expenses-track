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

//! Fecha de un movimiento. Un "YYYY-MM-DD" sin hora se guarda a las 12:00 UTC:
//! a medianoche UTC, en América ya es el día anterior y el movimiento aparecía
//! un día antes (pasaba al mandar "2026-09-15" por la API; el formulario web se
//! salvaba porque envía la hora local). El mediodía UTC es el mismo día de
//! calendario desde UTC-11 hasta UTC+11. Devuelve null si no es una fecha.
const parseTransactionDate = (value) => {
  if (typeof value === "string" && DATE_ONLY.test(value.trim())) {
    const [year, month, day] = value.trim().split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    //! Descarta días imposibles (2026-02-31 se convertiría en marzo)
    return date.getUTCDate() === day ? date : null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

//! Hasta el final de hoy. Los saldos y los totales solo cuentan lo que ya
//! pasó: un movimiento con fecha futura (una repetición creada por
//! adelantado) todavía no es dinero que entró o salió.
const endOfToday = () => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
};

//! Añade a un filtro el tope de "hasta hoy", respetando el que ya tuviera
const upToToday = (filters = {}) => {
  const limit = endOfToday();
  const date = { ...(filters.date || {}) };
  date.$lte = date.$lte && date.$lte < limit ? date.$lte : limit;
  return { ...filters, date };
};

module.exports = {
  parseStartDate,
  parseEndDate,
  getPeriodRange,
  parseTransactionDate,
  endOfToday,
  upToToday,
};
