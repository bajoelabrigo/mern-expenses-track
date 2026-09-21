import { cx } from "../ui/styles";

//! La marca de la app: el mismo icono que se instala en el teléfono, generado
//! por `scripts/generar-iconos.mjs` desde el logo maestro.
//!
//! Va siempre pegado al nombre "Control de Gastos", así que la imagen no se
//! anuncia aparte (`alt=""`): leerla otra vez solo estorba.
const TAMANOS = {
  sm: "h-9 w-9", // barra de las páginas públicas
  md: "h-8 w-8", // barra lateral de la app
  lg: "h-12 w-12", // pantallas de acceso
};

const AppLogo = ({ size = "md", className = "" }) => (
  <img
    src="/pwa-192x192.png"
    alt=""
    aria-hidden="true"
    className={cx("shrink-0", TAMANOS[size], className)}
  />
);

export default AppLogo;
