const Category = require("../model/Category");
const { CHURCH_INCOME_CATEGORIES, effectiveIncomeKind } = require("./incomeKinds");

//! Las categorías con las que arranca un espacio.
//!
//! Antes un espacio nuevo no tenía NINGUNA: para anotar la primera ofrenda había
//! que ir a Categorías y tocar un botón que nadie encuentra el primer día, y
//! hasta entonces el formulario de registro pedía elegir una categoría que no
//! existía. Con esto, un espacio recién creado ya sirve para anotar.
//!
//! Son un punto de partida, no una imposición: se renombran y se borran desde
//! Categorías, y si se borra alguna de las de ingreso el aviso para reponerlas
//! vuelve a aparecer.

//! Gastos que tiene cualquier iglesia. Corta a propósito: una lista de veinte no
//! ayuda a nadie a decidir en qué categoría va el recibo de la luz.
const CHURCH_EXPENSE_CATEGORIES = [
  { name: "servicios", icon: "🔧" },
  { name: "alquiler", icon: "🏠" },
  { name: "honorarios", icon: "🧾" },
  { name: "mantenimiento", icon: "🛠️" },
  { name: "actividades", icon: "🎉" },
  { name: "ayuda social", icon: "🤝" },
];

//! Y los de una casa, para el espacio personal de cada quien
const PERSONAL_INCOME_CATEGORIES = [
  { name: "sueldo", icon: "💼" },
  { name: "otros ingresos", icon: "💰" },
];

const PERSONAL_EXPENSE_CATEGORIES = [
  { name: "comida", icon: "🍞" },
  { name: "transporte", icon: "🚌" },
  { name: "casa", icon: "🏠" },
  { name: "servicios", icon: "🔧" },
  { name: "salud", icon: "🏥" },
];

const conTipo = (categorias, type) => categorias.map((c) => ({ ...c, type }));

//! Lo que le toca a un espacio según de qué es
const defaultsFor = (kind) =>
  kind === "personal"
    ? [
        ...conTipo(PERSONAL_INCOME_CATEGORIES, "income"),
        ...conTipo(PERSONAL_EXPENSE_CATEGORIES, "expense"),
      ]
    : [
        ...conTipo(CHURCH_INCOME_CATEGORIES, "income"),
        ...conTipo(CHURCH_EXPENSE_CATEGORIES, "expense"),
      ];

//! Crea las que falten en un espacio. Se puede llamar las veces que haga falta:
//! no duplica nada.
//!
//! De las de ingreso no se repite el TIPO: si el espacio ya tiene una categoría
//! de diezmos con otro nombre ("Diezmo mensual"), no se le añade otra.
//!
//! Nunca lanza: si algo falla, el espacio se queda sin esa categoría y se puede
//! crear a mano. Lo que no puede pasar es que un espacio no se cree porque una
//! categoría no se pudo guardar.
const crearCategoriasPorDefecto = async (workspace) => {
  const existentes = await Category.find({ workspace: workspace._id })
    .select("name type incomeKind")
    .lean();

  const nombres = new Set(existentes.map((c) => c.name));
  const tiposDeIngreso = new Set(
    existentes.map((c) => effectiveIncomeKind(c)).filter(Boolean)
  );

  const faltan = defaultsFor(workspace.kind).filter((categoria) => {
    if (nombres.has(categoria.name)) return false;
    if (categoria.type === "income" && tiposDeIngreso.has(categoria.incomeKind)) return false;
    return true;
  });

  const creadas = [];
  for (const categoria of faltan) {
    try {
      creadas.push(await Category.create({ ...categoria, workspace: workspace._id }));
    } catch (err) {
      //! Si se cruzó otra petición (o alguien la creó a mano), ya está: no es un
      //! error. Cualquier otra cosa se cuenta en el log y se sigue.
      if (err?.code !== 11000) {
        console.error(`[categorias] No se pudo crear "${categoria.name}":`, err.message);
      }
    }
  }

  return creadas;
};

module.exports = {
  CHURCH_EXPENSE_CATEGORIES,
  PERSONAL_INCOME_CATEGORIES,
  PERSONAL_EXPENSE_CATEGORIES,
  defaultsFor,
  crearCategoriasPorDefecto,
};
