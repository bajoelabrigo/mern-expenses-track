//! Monto en letras para las constancias: "tres mil quinientos con 50/100
//! soles". Es lo que se acostumbra en un documento formal.

const UNITS = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const HUNDREDS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

//! Nombre de la moneda en las constancias (singular, plural)
const CURRENCY_NAMES = {
  USD: ["dólar", "dólares"],
  EUR: ["euro", "euros"],
  PEN: ["sol", "soles"],
  MXN: ["peso mexicano", "pesos mexicanos"],
  COP: ["peso colombiano", "pesos colombianos"],
  ARS: ["peso argentino", "pesos argentinos"],
  CLP: ["peso chileno", "pesos chilenos"],
  BOB: ["boliviano", "bolivianos"],
  VES: ["bolívar", "bolívares"],
  GTQ: ["quetzal", "quetzales"],
  HNL: ["lempira", "lempiras"],
  NIO: ["córdoba", "córdobas"],
  CRC: ["colón", "colones"],
  DOP: ["peso dominicano", "pesos dominicanos"],
  PYG: ["guaraní", "guaraníes"],
  UYU: ["peso uruguayo", "pesos uruguayos"],
  BRL: ["real", "reales"],
};

//! 0-999. `apocope`: "un" en vez de "uno" cuando acompaña a mil o millones
const upToNineNinetyNine = (n, apocope = false) => {
  if (n === 100) return "cien";
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (hundreds) parts.push(HUNDREDS[hundreds]);
  if (rest) {
    if (rest < 30) {
      //! Delante de "mil" o "millones": un, veintiún (no uno, veintiuno)
      if (apocope && rest === 1) parts.push("un");
      else if (apocope && rest === 21) parts.push("veintiún");
      else parts.push(UNITS[rest]);
    } else {
      const tens = Math.floor(rest / 10);
      const unit = rest % 10;
      const word = unit ? `${TENS[tens]} y ${apocope && unit === 1 ? "un" : UNITS[unit]}` : TENS[tens];
      parts.push(word);
    }
  }
  return parts.join(" ");
};

//! Número entero en palabras (hasta 999 999 999)
const integerInWords = (value) => {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "cero";
  if (n > 999999999) return String(n);

  const millions = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const rest = n % 1000;
  const parts = [];

  if (millions === 1) parts.push("un millón");
  else if (millions > 1) parts.push(`${upToNineNinetyNine(millions, true)} millones`);
  if (thousands === 1) parts.push("mil");
  else if (thousands > 1) parts.push(`${upToNineNinetyNine(thousands, true)} mil`);
  if (rest) parts.push(upToNineNinetyNine(rest));

  return parts.join(" ");
};

//! "3500.5" + PEN → "tres mil quinientos con 50/100 soles"
const amountInWords = (amount, currency = "USD") => {
  const cents = Math.round(Math.abs(Number(amount) || 0) * 100);
  const whole = Math.floor(cents / 100);
  const decimals = String(cents % 100).padStart(2, "0");
  const [singular, plural] = CURRENCY_NAMES[currency] || [currency, currency];
  return `${integerInWords(whole)} con ${decimals}/100 ${whole === 1 ? singular : plural}`;
};

module.exports = { amountInWords, integerInWords, CURRENCY_NAMES };
