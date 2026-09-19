import { describe, it, expect } from "vitest";
import { formatMoney, parseTypedAmount, sumAmounts, toCents } from "../lib/money";

describe("dinero", () => {
  it("suma sin error de coma flotante", () => {
    //! 0.1 + 0.2 en coma flotante da 0.30000000000000004
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
    expect(sumAmounts([19.99, 0.01, 100])).toBe(120);
    expect(sumAmounts([])).toBe(0);
  });

  it("convierte a centavos redondeando", () => {
    expect(toCents(150.5)).toBe(15050);
    expect(toCents("10.01")).toBe(1001);
    expect(toCents(undefined)).toBe(0);
  });

  //! Intl separa símbolo y cifra con un espacio no separable (no se corta de línea)
  const plano = (texto) => texto.replace(/\s/g, " ");

  it("formatea como se lee en el país de la moneda", () => {
    expect(plano(formatMoney(1234.5, "PEN"))).toBe("S/ 1,234.50");
    expect(plano(formatMoney(1234.5, "USD"))).toBe("$1,234.50");
    expect(plano(formatMoney(1234.5, "COP"))).toBe("$ 1.234,50");
    //! El peso chileno no usa decimales
    expect(plano(formatMoney(1234.5, "CLP"))).toBe("$1.235");
  });

  it("no rompe con una moneda desconocida", () => {
    expect(formatMoney(5, "NOEXISTE")).toBe("NOEXISTE 5.00");
  });
});

describe("parseTypedAmount", () => {
  it("entiende los montos como los escribe la gente", () => {
    expect(parseTypedAmount("1500")).toBe(1500);
    expect(parseTypedAmount("1,500.50")).toBe(1500.5);
    expect(parseTypedAmount("1.500,50")).toBe(1500.5);
    expect(parseTypedAmount("150,5")).toBe(150.5);
    expect(parseTypedAmount("150.75")).toBe(150.75);
    expect(parseTypedAmount("1,500")).toBe(1500);
    expect(parseTypedAmount("2.000.000")).toBe(2000000);
    expect(parseTypedAmount(" 300 ")).toBe(300);
  });

  it("rechaza lo que no es un monto positivo", () => {
    for (const bad of ["", "abc", "0", "-5", "12a", null]) expect(parseTypedAmount(bad)).toBeNull();
  });
});
