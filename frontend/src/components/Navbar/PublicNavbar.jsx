import { Link } from "react-router-dom";
import { FaChurch } from "react-icons/fa6";
import { buttonClass } from "../ui/styles";

//! Barra de las páginas públicas (portada, entrar, crear cuenta)
export default function PublicNavbar() {
  return (
    <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" aria-label="Control de Gastos, inicio" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="h-9 w-9 rounded-xl bg-accent text-accent-ink grid place-items-center">
            <FaChurch aria-hidden="true" />
          </span>
          <span className="hidden sm:inline">Control de Gastos</span>
        </Link>
        <nav aria-label="Cuenta" className="flex items-center gap-2">
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
