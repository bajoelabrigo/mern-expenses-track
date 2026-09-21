import {
  LuBell,
  LuBookOpen,
  LuHandHeart,
  LuHistory,
  LuHouse,
  LuLayers,
  LuPiggyBank,
  LuHandCoins,
  LuHeartHandshake,
  LuFileText,
  LuReceiptText,
  LuShield,
  LuTags,
  LuUser,
  LuUsers,
} from "react-icons/lu";

//! Casi toda la app es el libro del espacio: sin "tx:read" no hay nada que
//! ver ahí. El único rol así es el líder de un ministerio, que entra a la app
//! solo por su presupuesto.
const leeElLibro = ({ can }) => can("tx:read");

//! Secciones de la app. `when` decide si se muestran según el rol en el
//! espacio (can) y si la persona es admin de la plataforma. `primary` (las que
//! van en la barra inferior del móvil) puede depender del rol.
export const NAV_ITEMS = [
  { to: "/dashboard", label: "Inicio", icon: LuHouse, primary: true, when: leeElLibro },
  {
    to: "/movimientos",
    label: "Movimientos",
    icon: LuReceiptText,
    primary: true,
    when: leeElLibro,
  },
  { to: "/fondos", label: "Fondos", icon: LuPiggyBank, when: leeElLibro },
  {
    to: "/ministerios",
    label: "Ministerios",
    icon: LuHandHeart,
    //! El presupuesto por ministerio es cosa de una iglesia. El líder lo ve
    //! con "ministry:own" y solo el suyo; la tesorería, todos.
    when: ({ can, workspace }) =>
      (can("ministry:read") || can("ministry:own")) && workspace?.kind === "iglesia",
    //! Para el líder es su única pantalla: va abajo, a mano
    primary: ({ can }) => !can("tx:read"),
  },
  {
    to: "/aportantes",
    label: "Personas",
    icon: LuHeartHandshake,
    //! Quién dio y quién recibió cuánto es cosa de la tesorería, y solo en una
    //! iglesia
    when: ({ can, workspace }) => can("donor:read") && workspace?.kind === "iglesia",
  },
  {
    to: "/conteos",
    label: "Conteo de ofrenda",
    icon: LuHandCoins,
    //! Contar la ofrenda entre dos solo tiene sentido en una iglesia
    when: ({ can, workspace }) => can("tx:read") && workspace?.kind === "iglesia",
  },
  { to: "/informes", label: "Informes", icon: LuFileText, when: leeElLibro },
  { to: "/categories", label: "Categorías", icon: LuTags, when: leeElLibro },
  //! Los avisos son del libro del espacio: quien no lo ve (el líder de un
  //! ministerio) tampoco los recibe, así que no se le ofrece la sección.
  { to: "/avisos", label: "Avisos", icon: LuBell, when: leeElLibro },
  //! Cómo se usa, con capturas. La ve cualquiera, también el líder.
  { to: "/ayuda", label: "Ayuda", icon: LuBookOpen },
  {
    to: "/espacio/miembros",
    label: "Miembros",
    icon: LuUsers,
    primary: true,
    when: leeElLibro,
  },
  { to: "/espacio/historial", label: "Historial", icon: LuHistory, when: ({ can }) => can("audit:read") },
  { to: "/espacios", label: "Espacios", icon: LuLayers },
  { to: "/profile", label: "Perfil", icon: LuUser },
  { to: "/admin/users", label: "Administración", icon: LuShield, when: ({ isAdmin }) => isAdmin },
];

export const visibleNavItems = (ctx) =>
  NAV_ITEMS.filter((item) => !item.when || item.when(ctx)).map((item) => ({
    ...item,
    primary: typeof item.primary === "function" ? item.primary(ctx) : Boolean(item.primary),
  }));
