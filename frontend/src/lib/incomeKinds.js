//! Tipos de ingreso de iglesia (los mismos que valida el backend en
//! utils/incomeKinds.js). El orden es el de los informes.
export const INCOME_KINDS = [
  { value: "diezmo", label: "Diezmo", plural: "Diezmos" },
  { value: "ofrenda", label: "Ofrenda", plural: "Ofrendas" },
  { value: "primicia", label: "Primicia", plural: "Primicias" },
  { value: "especial", label: "Ofrenda especial", plural: "Ofrendas especiales" },
  { value: "otro", label: "Otro ingreso", plural: "Otros ingresos" },
];

export const incomeKindLabel = (value) => INCOME_KINDS.find((k) => k.value === value)?.label || "";

//! Categorías base de iglesia; faltan las de los tipos que ninguna categoría cubre
const BASE_KINDS = ["diezmo", "ofrenda", "primicia", "especial"];
export const missingChurchKinds = (categories = []) => {
  const present = new Set(categories.filter((c) => c.type === "income").map((c) => c.incomeKind));
  return INCOME_KINDS.filter((k) => BASE_KINDS.includes(k.value) && !present.has(k.value));
};

//! El mismo criterio que el backend (inferIncomeKind): el tipo que sugiere el
//! nombre mientras se escribe
export const inferIncomeKind = (name) => {
  const text = String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (/diezm/.test(text)) return "diezmo";
  if (/primici/.test(text)) return "primicia";
  if (/especial/.test(text)) return "especial";
  if (/ofrend/.test(text)) return "ofrenda";
  return "otro";
};
