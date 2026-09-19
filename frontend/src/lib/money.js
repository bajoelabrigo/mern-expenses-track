//! Dinero en el cliente. La API habla en unidades (150.5), pero sumar decimales
//! en coma flotante acumula error (0.1 + 0.2 = 0.30000000000000004): las sumas
//! se hacen en centavos enteros y se convierten al final.

export const toCents = (amount) => Math.round(Number(amount || 0) * 100);

export const fromCents = (cents) => cents / 100;

//! Suma una lista de montos (en unidades) sin error de redondeo
export const sumAmounts = (amounts) =>
  fromCents(amounts.reduce((acc, amount) => acc + toCents(amount), 0));

//! Las mismas monedas que admite el backend (utils/money.js), cada una con la
//! configuración regional de su país: con un "es" genérico un monto en soles
//! sale como "1234,50 PEN" en vez de "S/ 1,234.50", que es lo que se espera
//! leer en Perú. Lo mismo con el separador de miles de cada país.
export const CURRENCIES = [
  { code: "USD", label: "Dólar estadounidense", locale: "es-US" },
  { code: "EUR", label: "Euro", locale: "es-ES" },
  { code: "PEN", label: "Sol peruano", locale: "es-PE" },
  { code: "MXN", label: "Peso mexicano", locale: "es-MX" },
  { code: "COP", label: "Peso colombiano", locale: "es-CO" },
  { code: "ARS", label: "Peso argentino", locale: "es-AR" },
  { code: "CLP", label: "Peso chileno", locale: "es-CL", decimals: 0 },
  { code: "BOB", label: "Boliviano", locale: "es-BO" },
  { code: "VES", label: "Bolívar venezolano", locale: "es-VE" },
  { code: "GTQ", label: "Quetzal", locale: "es-GT" },
  { code: "HNL", label: "Lempira", locale: "es-HN" },
  { code: "NIO", label: "Córdoba", locale: "es-NI" },
  { code: "CRC", label: "Colón costarricense", locale: "es-CR" },
  { code: "DOP", label: "Peso dominicano", locale: "es-DO" },
  { code: "PYG", label: "Guaraní", locale: "es-PY", decimals: 0 },
  { code: "UYU", label: "Peso uruguayo", locale: "es-UY" },
  { code: "BRL", label: "Real brasileño", locale: "pt-BR" },
];

const BY_CODE = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));

//! Formatea con el símbolo y los separadores del país de la moneda. Los
//! decimales se fijan aquí (2, o 0 para peso chileno y guaraní) en vez de
//! dejarlos a los datos regionales del navegador: según la versión, el mismo
//! peso colombiano salía "$ 1.234,50" en un sitio y "$ 1.235" en otro.
export const formatMoney = (amount, currency = "USD") => {
  const decimals = BY_CODE[currency]?.decimals ?? 2;
  try {
    return new Intl.NumberFormat(BY_CODE[currency]?.locale || "es", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(amount || 0));
  } catch {
    //! Código de moneda que el navegador no conoce
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
};

//! Monto mientras se teclea ("12", "12.", "12.5"): se muestra con el símbolo y
//! los separadores del país, respetando los decimales escritos hasta ahora
//! (sin inventar ",00" ni comerse la coma recién pulsada).
export const formatTypedAmount = (typed, currency = "USD") => {
  const locale = BY_CODE[currency]?.locale || "es";
  const [, dec = ""] = typed.split(".");
  const decimals = typed.includes(".") ? Math.min(dec.length, 2) : 0;
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    let text = formatter.format(Number(typed || 0));
    if (typed.endsWith(".")) {
      const separator =
        new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === "decimal")?.value || ".";
      //! La coma recién pulsada va justo después de la última cifra
      text = text.replace(/(\d)(?!.*\d)/, `$1${separator}`);
    }
    return text;
  } catch {
    return `${currency} ${typed || "0"}`;
  }
};

//! Monto escrito a mano ("1500", "1,500.50", "1.500,50", "150,5") → número, o
//! null si no es un monto. Si aparecen coma y punto, el último es el decimal;
//! si solo hay uno, es decimal cuando lo siguen 1 o 2 cifras.
export const parseTypedAmount = (text) => {
  const raw = String(text ?? "").replace(/\s/g, "");
  if (!raw || !/^[0-9.,]+$/.test(raw)) return null;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized;
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normalized = raw.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? "," : ".";
    const parts = raw.split(sep);
    const isDecimal = parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 2;
    normalized = isDecimal ? parts.join(".") : parts.join("");
  } else {
    normalized = raw;
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
};
