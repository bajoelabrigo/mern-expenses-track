//! Conversión de dinero. Los montos se guardan en CENTAVOS enteros: sumar
//! decimales en coma flotante acumula error (0.1 + 0.2 !== 0.3). Toda la API
//! habla en unidades (150.50); la conversión ocurre solo aquí.

//! Unidades -> centavos. Devuelve null si no es un número finito.
const toCents = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
};

//! Centavos -> unidades (para responder por la API).
const fromCents = (cents) => (Number(cents) || 0) / 100;

//! Monedas admitidas por espacio (ISO 4217). La lista es corta a propósito:
//! un código libre acabaría con "usd", "US$" y "dolares" en la misma base.
const CURRENCIES = [
  "USD",
  "EUR",
  "PEN",
  "MXN",
  "COP",
  "ARS",
  "CLP",
  "BOB",
  "VES",
  "GTQ",
  "HNL",
  "NIO",
  "CRC",
  "DOP",
  "PYG",
  "UYU",
  "BRL",
];

//! Cada moneda con el país cuyo formato se usa al escribirla ("S/ 1,234.50" y
//! no "1234,50 PEN"). Es la misma tabla que el frontend (lib/money.js).
const CURRENCY_FORMATS = {
  USD: { locale: "es-US" },
  EUR: { locale: "es-ES" },
  PEN: { locale: "es-PE" },
  MXN: { locale: "es-MX" },
  COP: { locale: "es-CO" },
  ARS: { locale: "es-AR" },
  CLP: { locale: "es-CL", decimals: 0 },
  BOB: { locale: "es-BO" },
  VES: { locale: "es-VE" },
  GTQ: { locale: "es-GT" },
  HNL: { locale: "es-HN" },
  NIO: { locale: "es-NI" },
  CRC: { locale: "es-CR" },
  DOP: { locale: "es-DO" },
  PYG: { locale: "es-PY", decimals: 0 },
  UYU: { locale: "es-UY" },
  BRL: { locale: "pt-BR" },
};

//! Monto con el símbolo de su moneda, para documentos (constancias, informes)
const formatMoney = (amount, currency = "USD") => {
  const decimals = CURRENCY_FORMATS[currency]?.decimals ?? 2;
  try {
    return new Intl.NumberFormat(CURRENCY_FORMATS[currency]?.locale || "es", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
};

module.exports = { toCents, fromCents, CURRENCIES, formatMoney };
