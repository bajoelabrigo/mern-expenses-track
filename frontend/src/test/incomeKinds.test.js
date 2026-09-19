import { describe, it, expect } from "vitest";
import { inferIncomeKind, missingChurchKinds } from "../lib/incomeKinds";

describe("tipos de ingreso de iglesia", () => {
  it("deduce el tipo del nombre, como el backend", () => {
    expect(inferIncomeKind("Diezmos del mes")).toBe("diezmo");
    expect(inferIncomeKind("PRIMÍCIAS")).toBe("primicia");
    expect(inferIncomeKind("Ofrenda especial de aniversario")).toBe("especial");
    expect(inferIncomeKind("ofrendas")).toBe("ofrenda");
    expect(inferIncomeKind("pactos")).toBe("otro");
  });

  it("solo faltan las base que ninguna categoría de ingreso cubre", () => {
    const categorias = [
      { type: "income", incomeKind: "diezmo" },
      { type: "income", incomeKind: "especial" },
      //! Un gasto no cubre nada aunque tenga tipo
      { type: "expense", incomeKind: "ofrenda" },
    ];
    expect(missingChurchKinds(categorias).map((k) => k.value)).toEqual(["ofrenda", "primicia"]);
    expect(missingChurchKinds([])).toHaveLength(4);
  });
});
