import { Link } from "react-router-dom";
import AppLogo from "../layout/AppLogo";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { buttonClass } from "../ui/styles";

//! Barra de las páginas públicas (portada, entrar, crear cuenta)
export default function PublicNavbar() {
  //! Con esto se decide si cabe el enlace de la ayuda. NO se usa `hidden
  //! sm:inline-flex`: en la versión de Tailwind del proyecto la regla de
  //! `inline-flex` se emite después de la de `hidden`, así que el elemento
  //! seguiría viéndose (y en el móvil la barra se rompe en tres líneas).
  const cabeTodo = useIsDesktop();

  return (
    <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" aria-label="Control de Gastos, inicio" className="flex items-center gap-2 font-extrabold tracking-tight">
          <AppLogo size="sm" />
          <span className="hidden sm:inline">Control de Gastos</span>
        </Link>
        <nav aria-label="Cuenta" className="flex items-center gap-2">
          {/* En el móvil no cabe (la barra ya lleva Descargar, Entrar y Crear
              cuenta): ahí se llega desde el pie de la portada o por el enlace
              que se comparte por WhatsApp. */}
          {cabeTodo && (
            <Link to="/ayuda" className={buttonClass({ variant: "ghost", size: "sm" })}>
              Cómo se usa
            </Link>
          )}
          <Link to="/descargas" className={buttonClass({ variant: "ghost", size: "sm" })}>
            Descargar
          </Link>
          <Link to="/login" className={buttonClass({ variant: "ghost", size: "sm" })}>
            Entrar
          </Link>
          <Link to="/register" className={buttonClass({ variant: "primary", size: "sm" })}>
            Crear cuenta
          </Link>
        </nav>
      </div>
    </header>
  );
}
