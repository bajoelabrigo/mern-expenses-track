//! Teclado numérico del formulario de alta: el monto se lleva como texto
//! ("12.5") para respetar lo que la persona va escribiendo.
const MAX_INTEGER_DIGITS = 9;

export const pressKey = (amount, key) => {
  if (key === "back") return amount.slice(0, -1);
  if (key === ".") return amount.includes(".") ? amount : `${amount || "0"}.`;
  const [int, dec] = amount.split(".");
  if (dec !== undefined) return dec.length >= 2 ? amount : amount + key;
  if (int.length >= MAX_INTEGER_DIGITS) return amount;
  if (int === "0") return key;
  return amount + key;
};
