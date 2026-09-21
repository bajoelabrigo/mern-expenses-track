//! Clases y colores compartidos por los componentes de ui/ (fuera del
//! archivo de componentes para que la recarga en caliente funcione).

export const cx = (...classes) => classes.filter(Boolean).join(" ");

const BUTTON_VARIANTS = {
  //! Acción principal de la pantalla: tinta sobre fondo (negro en claro, blanco en oscuro)
  primary: "bg-ink text-surface hover:opacity-90",
  //! Registrar: el ámbar se reserva para "añadir dinero al libro"
  accent: "bg-accent text-accent-ink hover:brightness-95",
  //! Hacerse socio, y nada más: no es dinero de la iglesia
  support: "bg-support text-support-ink hover:brightness-110",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
  "danger-ghost": "text-danger hover:bg-danger-soft",
};

const BUTTON_SIZES = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-6 text-base",
};

//! OJO al ocultar un botón con la clase `hidden`: en la versión de Tailwind del
//! proyecto, `display:none` se emite ANTES que `inline-flex` (que va aquí en la
//! base), así que el botón se sigue viendo. Para eso está `useIsDesktop()` o
//! envolver el botón en un contenedor con `hidden lg:block`.
export const buttonClass = ({ variant = "primary", size = "md", block, className } = {}) =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition",
    "disabled:opacity-50 disabled:pointer-events-none",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    block && "w-full",
    className
  );

export const inputClass = (className = "") =>
  cx(
    "h-12 w-full rounded-xl bg-surface border border-line px-4 text-[15px]",
    "focus:outline-none focus:border-ink transition",
    className
  );

//! Colores de categoría (dona, iconos). Distinguibles entre sí y en ambos temas.
export const CATEGORY_COLORS = [
  "#e5a33b", // ámbar
  "#e25c4c", // coral
  "#1fb5a5", // turquesa
  "#2f9e5b", // verde
  "#5b7fe0", // azul
  "#9b6bd6", // lila
  "#a3a09a", // gris (resto)
];

const hash = (text) =>
  [...String(text)].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);

export const categoryColor = (name) =>
  CATEGORY_COLORS[hash(name) % (CATEGORY_COLORS.length - 1)];

//! "alquiler del local" → "Alquiler del local" (la clase `capitalize` de CSS
//! pondría mayúscula a cada palabra)
export const capitalize = (text = "") => text.charAt(0).toUpperCase() + text.slice(1);

//! "pastor_juan" → "PJ", para los avatares
export const initials = (name) =>
  (name || "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";
