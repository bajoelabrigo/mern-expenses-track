import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { LuEllipsis, LuLogOut, LuPlus, LuX } from "react-icons/lu";
import { FaChurch } from "react-icons/fa6";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useLogout } from "../../hooks/useLogout";
import { visibleNavItems } from "./navItems";
import ThemeToggle from "./ThemeToggle";
import WorkspacePicker from "./WorkspacePicker";
import { buttonClass } from "../ui/styles";

const useNavContext = () => {
  const user = useSelector((state) => state.auth.user);
  const { can, workspace } = useWorkspace();
  return { can, workspace, isAdmin: user?.role === "admin", user };
};

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] font-semibold transition ${
    isActive ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
  }`;

//! Escritorio: barra lateral fija
export const Sidebar = () => {
  const ctx = useNavContext();
  const logout = useLogout();
  const items = visibleNavItems(ctx);

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col gap-6 px-4 py-6 border-r border-line bg-bg">
      <div className="flex items-center gap-2 px-2">
        <FaChurch aria-hidden="true" className="text-accent text-2xl" />
        <span className="font-extrabold tracking-tight">Control de Gastos</span>
      </div>

      <div className="px-2">
        <WorkspacePicker />
      </div>

      {ctx.can("tx:write") && (
        <NavLinkButton />
      )}

      <nav aria-label="Secciones" className="flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={navLinkClass}>
            <Icon aria-hidden="true" className="text-lg" /> {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <ThemeToggle />
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] font-semibold text-muted hover:text-danger"
        >
          <LuLogOut aria-hidden="true" className="text-lg" /> Salir
        </button>
      </div>
    </aside>
  );
};

const NavLinkButton = () => (
  <NavLink to="/add-transaction" className={buttonClass({ variant: "accent", block: true })}>
    <LuPlus aria-hidden="true" className="text-lg" /> Registrar
  </NavLink>
);

//! Móvil: barra inferior con el botón de registrar en el centro
export const BottomNav = () => {
  const ctx = useNavContext();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const primary = visibleNavItems(ctx).filter((item) => item.primary);
  const [first, second, third] = primary;

  //! Al navegar se cierra el menú "Más"
  useEffect(() => setMoreOpen(false), [location.pathname]);

  //! Registrar y editar ocupan la pantalla entera (el teclado va abajo)
  if (/^\/(add-transaction|update-transactions)/.test(location.pathname)) return null;

  const tab = ({ isActive }) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
      isActive ? "text-ink" : "text-muted"
    }`;

  return (
    <>
      <nav
        aria-label="Secciones"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-line pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-stretch h-16 max-w-lg mx-auto px-2">
          {[first, second].map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={tab}>
              <Icon aria-hidden="true" className="text-[22px]" /> {label}
            </NavLink>
          ))}

          <div className="flex flex-1 items-center justify-center">
            {ctx.can("tx:write") ? (
              <NavLink
                to="/add-transaction"
                aria-label="Registrar movimiento"
                className="-mt-6 h-14 w-14 rounded-full bg-accent text-accent-ink flex items-center justify-center shadow-[0_6px_16px_rgb(229_163_59/0.45)]"
              >
                <LuPlus aria-hidden="true" className="text-[26px]" />
              </NavLink>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>

          <NavLink to={third.to} className={tab}>
            <third.icon aria-hidden="true" className="text-[22px]" /> {third.label}
          </NavLink>

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              moreOpen ? "text-ink" : "text-muted"
            }`}
          >
            <LuEllipsis aria-hidden="true" className="text-[22px]" /> Más
          </button>
        </div>
      </nav>

      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} ctx={ctx} />}
    </>
  );
};

//! Hoja inferior con el resto de secciones, el tema y salir
const MoreSheet = ({ onClose, ctx }) => {
  const logout = useLogout();
  const items = visibleNavItems(ctx).filter((item) => !item.primary);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Más opciones">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute bottom-0 inset-x-0 rounded-t-3xl bg-bg p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-center justify-between mb-3 px-1">
          <WorkspacePicker />
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 text-muted">
            <LuX aria-hidden="true" className="text-xl" />
          </button>
        </div>

        <nav aria-label="Más secciones" className="bg-surface rounded-card shadow-card divide-y divide-line overflow-hidden">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="flex items-center gap-3 h-13 px-4 text-[15px] font-semibold text-ink"
            >
              <Icon aria-hidden="true" className="text-lg text-muted" /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 bg-surface rounded-card shadow-card p-3">
          <p className="text-xs font-semibold text-muted mb-2 px-1">Tema</p>
          <ThemeToggle />
        </div>

        <button
          type="button"
          onClick={logout}
          className="mt-4 w-full h-12 rounded-card bg-surface shadow-card flex items-center justify-center gap-2 font-semibold text-danger"
        >
          <LuLogOut aria-hidden="true" /> Salir
        </button>
      </div>
    </div>
  );
};
