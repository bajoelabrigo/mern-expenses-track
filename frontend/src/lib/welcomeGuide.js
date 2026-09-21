//! Guía de primeros pasos del Inicio: qué le falta a un espacio para quedar
//! armado, y si quien lo está viendo ya la ocultó.
//!
//! Se guarda por espacio Y por persona: la guía es de este libro, y en una
//! computadora compartida (la de la iglesia) cada quien tiene la suya.

const KEY = "guia-inicio";

const keyOf = (workspaceId, userId) => `${KEY}:${workspaceId}:${userId}`;

//! Lo que se guarda: "oculta" (la cerró a mano), "listo" (terminó los pasos) o
//! "pedida" (pidió verla otra vez). Pedida manda sobre las otras dos: si no,
//! quien la pide en un espacio ya terminado no vería nada.
const OCULTA = "oculta";
const LISTO = "listo";
const PEDIDA = "pedida";

const guideState = (workspaceId, userId) => {
  try {
    return localStorage.getItem(keyOf(workspaceId, userId));
  } catch {
    //! Sin almacenamiento la guía se muestra siempre: mejor repetirla que perderla
    return null;
  }
};

const setGuideState = (workspaceId, userId, estado) => {
  try {
    localStorage.setItem(keyOf(workspaceId, userId), estado);
  } catch {
    //! Modo privado o almacenamiento bloqueado: vale solo para esta visita
  }
};

//! ¿Ya no hay que mostrarla?
export const isGuideHidden = (workspaceId, userId) =>
  [OCULTA, LISTO].includes(guideState(workspaceId, userId));

//! ¿La pidieron a mano? Entonces se muestra aunque esté terminada
export const isGuideRequested = (workspaceId, userId) =>
  guideState(workspaceId, userId) === PEDIDA;

export const hideGuide = (workspaceId, userId) => setGuideState(workspaceId, userId, OCULTA);

//! Se terminaron los pasos: no vuelve sola
export const finishGuide = (workspaceId, userId) => setGuideState(workspaceId, userId, LISTO);

//! Volver a mostrarla (desde el Perfil)
export const showGuide = (workspaceId, userId) => setGuideState(workspaceId, userId, PEDIDA);

//! Los pasos que le sirven a este espacio y a este rol. `done` se calcula con
//! datos que el Inicio ya tiene (movimientos, fondos, personas) más la lista de
//! miembros: ningún paso cuesta una consulta de más.
export const buildSteps = ({ can, kind, hasMovimientos, hasFunds, miembros, personas }) => {
  const steps = [
    {
      id: "movimiento",
      title: "Registra el primer movimiento",
      hint: "Un ingreso o un gasto: con eso ya ves tus números.",
      to: "/add-transaction",
      done: Boolean(hasMovimientos),
    },
  ];

  //! Sumar gente es de quien gestiona miembros (propietario y tesorero)
  if (can("members:manage")) {
    steps.push({
      id: "equipo",
      title: "Suma a tu equipo",
      hint: "Tu tesorera, tu contador o quien te ayuda a contar. Cada uno con su rol.",
      to: "/espacio/miembros",
      //! Uno solo es quien acaba de crear el espacio: el equipo empieza en dos
      done: Number(miembros) > 1,
    });
  }

  //! Los fondos son de la tesorería (propietario y tesorero)
  if (can("fund:manage")) {
    steps.push({
      id: "fondo",
      title: "Crea tu primer fondo",
      hint: "Separa el dinero por destino —misiones, obra, ayuda social— además del General.",
      to: "/fondos",
      //! El General es virtual: `hasFunds` mira los fondos de verdad
      done: Boolean(hasFunds),
    });
  }

  //! Quién dio y quién recibió solo existe en una iglesia, y lo ve la tesorería
  if (kind === "iglesia" && can("donor:read")) {
    steps.push({
      id: "personas",
      title: "Carga a las personas",
      hint: "Así cada aporte queda con nombre, y puedes ver quién dio cuánto.",
      to: "/aportantes",
      done: Number(personas) > 0,
    });
  }

  return steps;
};

//! Cuántos van, cuántos son y si ya no queda ninguno
export const guideProgress = (steps) => ({
  hechos: steps.filter((step) => step.done).length,
  total: steps.length,
  listo: steps.length > 0 && steps.every((step) => step.done),
});
