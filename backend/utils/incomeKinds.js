//! Tipos de ingreso de una iglesia. Cada categoría de ingreso tiene uno; así
//! los informes separan diezmos de ofrendas aunque cada iglesia nombre sus
//! categorías a su manera ("Diezmo", "Diezmos del mes", "Primicias"…).
const INCOME_KINDS = ["diezmo", "ofrenda", "primicia", "especial", "otro"];

//! Categorías base que se ofrecen a un espacio de iglesia
const CHURCH_INCOME_CATEGORIES = [
  { name: "diezmos", icon: "🙏", incomeKind: "diezmo" },
  { name: "ofrendas", icon: "💝", incomeKind: "ofrenda" },
  { name: "primicias", icon: "🌾", incomeKind: "primicia" },
  { name: "ofrenda especial", icon: "🎁", incomeKind: "especial" },
];

const plain = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

//! Tipo que se deduce del nombre, para las categorías que existían antes de
//! que hubiera tipos (así no hace falta migrar nada). Quien quiera otro lo
//! elige a mano y queda guardado.
const inferIncomeKind = (name) => {
  const text = plain(name);
  if (/diezm/.test(text)) return "diezmo";
  if (/primici/.test(text)) return "primicia";
  if (/especial/.test(text)) return "especial";
  if (/ofrend/.test(text)) return "ofrenda";
  return "otro";
};

//! El tipo efectivo de una categoría: el guardado o, si no hay, el deducido.
//! Las de gasto no tienen tipo de ingreso.
const effectiveIncomeKind = (category) => {
  if (!category || category.type !== "income") return null;
  return category.incomeKind || inferIncomeKind(category.name);
};

module.exports = { INCOME_KINDS, CHURCH_INCOME_CATEGORIES, inferIncomeKind, effectiveIncomeKind };
