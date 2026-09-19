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
  { code: "CLP", label: "Peso chileno", locale: "es-CL" },
  { code: "BOB", label: "Boliviano", locale: "es-BO" },
  { code: "VES", label: "Bolívar venezolano", locale: "es-VE" },
  { code: "GTQ", label: "Quetzal", locale: "es-GT" },
  { code: "HNL", label: "Lempira", locale: "es-HN" },
  { code: "NIO", label: "Córdoba", locale: "es-NI" },
  { code: "CRC", label: "Colón costarricense", locale: "es-CR" },
  { code: "DOP", label: "Peso dominicano", locale: "es-DO" },
  { code: "PYG", label: "Guaraní", locale: "es-PY" },
  { code: "UYU", label: "Peso uruguayo", locale: "es-UY" },
  { code: "BRL", label: "Real brasileño", locale: "pt-BR" },
];

const LOCALES = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.locale]));

//! Formatea con el símbolo y los separadores del país de la moneda. Los
//! decimales son los habituales de cada moneda (el peso chileno no usa).
export const formatMoney = (amount, currency = "USD") => {
  try {
    return new Intl.NumberFormat(LOCALES[currency] || "es", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(Number(amount || 0));
  } catch {
    //! Código de moneda que el navegador no conoce
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
};
