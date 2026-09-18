const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
const { limpiar } = require("../config/env");

//! Errores habituales al pegar variables en paneles como Render o Netlify
describe("limpieza de variables de entorno", () => {
  test("quita espacios y saltos de línea sobrantes", () => {
    assert.equal(
      limpiar("MONGO_URL", "  mongodb+srv://u:p@host/base \n"),
      "mongodb+srv://u:p@host/base"
    );
  });

  test("quita el nombre de la variable pegado por delante", () => {
    assert.equal(
      limpiar("MONGO_URL", "MONGO_URL=mongodb+srv://u:p@host/base"),
      "mongodb+srv://u:p@host/base"
    );
    assert.equal(
      limpiar("MONGO_URL", "MONGO_URL = mongodb+srv://u:p@host/base"),
      "mongodb+srv://u:p@host/base"
    );
  });

  test("quita las comillas que envuelven el valor", () => {
    assert.equal(
      limpiar("MONGO_URL", '"mongodb+srv://u:p@host/base"'),
      "mongodb+srv://u:p@host/base"
    );
    assert.equal(
      limpiar("MONGO_URL", "'mongodb+srv://u:p@host/base'"),
      "mongodb+srv://u:p@host/base"
    );
  });

  test("combina los tres casos a la vez", () => {
    assert.equal(
      limpiar("MONGO_URL", '  MONGO_URL="mongodb+srv://u:p@host/base"  '),
      "mongodb+srv://u:p@host/base"
    );
  });

  test("no toca un valor correcto ni las comillas internas", () => {
    assert.equal(
      limpiar("MONGO_URL", "mongodb+srv://u:p@host/base"),
      "mongodb+srv://u:p@host/base"
    );
    //! Una contraseña que contenga comillas dentro no debe alterarse
    assert.equal(
      limpiar("JWT_SECRET", "abc\"def'ghi"),
      "abc\"def'ghi"
    );
  });

  test("tolera valores ausentes", () => {
    assert.equal(limpiar("MONGO_URL", undefined), undefined);
    assert.equal(limpiar("MONGO_URL", ""), "");
  });
});
