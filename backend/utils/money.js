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

module.exports = { toCents, fromCents, CURRENCIES };
