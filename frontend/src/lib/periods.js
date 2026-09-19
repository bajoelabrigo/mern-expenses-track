//! Períodos del Inicio (semana, mes, año en curso) y el anterior para comparar.
//! Fechas "YYYY-MM-DD" en hora local: la API las interpreta como días
//! completos (el fin incluye todo ese día).

const pad = (n) => String(n).padStart(2, "0");
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

//! Lunes de la semana de `d`
const startOfWeek = (d) => {
  const day = (d.getDay() + 6) % 7; // lunes = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
};

export const periodRange = (period, today = new Date()) => {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let start;
  let end;
  let prevStart;
  let prevEnd;
  let label;

  if (period === "week") {
    start = startOfWeek(t);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    prevStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
    prevEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
    label = "esta semana";
  } else if (period === "year") {
    start = new Date(t.getFullYear(), 0, 1);
    end = new Date(t.getFullYear(), 11, 31);
    prevStart = new Date(t.getFullYear() - 1, 0, 1);
    prevEnd = new Date(t.getFullYear() - 1, 11, 31);
    label = String(t.getFullYear());
  } else {
    start = new Date(t.getFullYear(), t.getMonth(), 1);
    end = new Date(t.getFullYear(), t.getMonth() + 1, 0);
    prevStart = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    prevEnd = new Date(t.getFullYear(), t.getMonth(), 0);
    label = MONTHS[t.getMonth()];
  }

  return {
    start: toISODate(start),
    end: toISODate(end),
    prevStart: toISODate(prevStart),
    prevEnd: toISODate(prevEnd),
    label,
    previousLabel: { week: "la semana pasada", month: MONTHS[prevStart.getMonth()], year: String(prevStart.getFullYear()) }[period] || MONTHS[prevStart.getMonth()],
  };
};

//! "24 sep", "hoy", "ayer" para agrupar movimientos
export const dayLabel = (dateValue, today = new Date()) => {
  const d = new Date(dateValue);
  const key = toISODate(d);
  if (key === toISODate(today)) return "Hoy";
  const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (key === toISODate(y)) return "Ayer";
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

export const shortDate = (dateValue) =>
  new Date(dateValue).toLocaleDateString("es", { day: "numeric", month: "short" });
