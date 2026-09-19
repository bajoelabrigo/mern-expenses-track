const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { amountInWords, integerInWords } = require("../utils/amountInWords");

describe("Monto en letras", () => {
  test("escribe los números como se dicen", () => {
    const casos = {
      0: "cero",
      1: "uno",
      15: "quince",
      21: "veintiuno",
      31: "treinta y uno",
      100: "cien",
      101: "ciento uno",
      200: "doscientos",
      999: "novecientos noventa y nueve",
      1000: "mil",
      1001: "mil uno",
      2000: "dos mil",
      21000: "veintiún mil",
      100000: "cien mil",
      1000000: "un millón",
      2500000: "dos millones quinientos mil",
    };
    for (const [numero, letras] of Object.entries(casos)) {
      assert.equal(integerInWords(Number(numero)), letras, `${numero}`);
    }
  });

  test("agrega los centavos y el nombre de la moneda", () => {
    assert.equal(amountInWords(3500.5, "PEN"), "tres mil quinientos con 50/100 soles");
    assert.equal(amountInWords(1, "PEN"), "uno con 00/100 sol");
    assert.equal(amountInWords(0, "PEN"), "cero con 00/100 soles");
    assert.equal(amountInWords(12.34, "USD"), "doce con 34/100 dólares");
    assert.equal(amountInWords(150.005, "PEN"), "ciento cincuenta con 01/100 soles");
  });
});
