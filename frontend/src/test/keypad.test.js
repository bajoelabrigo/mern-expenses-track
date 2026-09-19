import { describe, it, expect } from "vitest";
import { pressKey } from "../lib/keypad";
import { formatTypedAmount } from "../lib/money";

const teclear = (keys) => keys.reduce((amount, key) => pressKey(amount, key), "");
const plano = (texto) => texto.replace(/\s/g, " ");

describe("teclado numérico", () => {
  it("escribe enteros y decimales, con un máximo de 2 decimales", () => {
    expect(teclear(["1", "8", "5", ".", "3", "0", "9"])).toBe("185.30");
  });

  it("no deja ceros a la izquierda ni dos comas", () => {
    expect(teclear(["0", "0", "7"])).toBe("7");
    expect(teclear([".", "5", ".", "5"])).toBe("0.55");
  });

  it("borra de a una cifra", () => {
    expect(teclear(["1", "2", ".", "5", "back", "back"])).toBe("12");
    expect(teclear(["back"])).toBe("");
  });

  it("limita los enteros a 9 cifras", () => {
    expect(teclear(Array(12).fill("9"))).toBe("999999999");
  });
});

describe("monto mientras se escribe", () => {
  it("respeta los decimales escritos y el separador del país", () => {
    expect(plano(formatTypedAmount("", "PEN"))).toBe("S/ 0");
    expect(plano(formatTypedAmount("1850", "PEN"))).toBe("S/ 1,850");
    expect(plano(formatTypedAmount("185.", "PEN"))).toBe("S/ 185.");
    expect(plano(formatTypedAmount("185.3", "PEN"))).toBe("S/ 185.3");
    //! En pesos colombianos el separador decimal es la coma
    expect(plano(formatTypedAmount("185.", "COP"))).toBe("$ 185,");
  });
});
