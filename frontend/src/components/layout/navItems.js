import {
  LuHistory,
  LuHouse,
  LuLayers,
  LuPiggyBank,
  LuHeartHandshake,
  LuFileText,
  LuReceiptText,
  LuShield,
  LuTags,
  LuUser,
  LuUsers,
} from "react-icons/lu";

//! Secciones de la app. `when` decide si se muestran según el rol en el
//! espacio (can) y si la persona es admin de la plataforma.
export const NAV_ITEMS = [
  { to: "/dashboard", label: "Inicio", icon: LuHouse, primary: true },
  { to: "/movimientos", label: "Movimientos", icon: LuReceiptText, primary: true },
  { to: "/fondos", label: "Fondos", icon: LuPiggyBank },
  {
    to: "/aportantes",
    label: "Aportantes",
    icon: LuHeartHandshake,
    //! Quién dio cuánto es cosa de la tesorería, y solo en una iglesia
    when: ({ can, workspace }) => can("donor:read") && workspace?.kind === "iglesia",
  },
  { to: "/informes", label: "Informes", icon: LuFileText },
  { to: "/categories", label: "Categorías", icon: LuTags },
  { to: "/espacio/miembros", label: "Miembros", icon: LuUsers, primary: true },
  { to: "/espacio/historial", label: "Historial", icon: LuHistory, when: ({ can }) => can("audit:read") },
  { to: "/espacios", label: "Espacios", icon: LuLayers },
  { to: "/profile", label: "Perfil", icon: LuUser },
  { to: "/admin/users", label: "Administración", icon: LuShield, when: ({ isAdmin }) => isAdmin },
];

export const visibleNavItems = (ctx) => NAV_ITEMS.filter((item) => !item.when || item.when(ctx));
