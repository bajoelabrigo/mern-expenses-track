import { Disclosure } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import { IoLogOutOutline } from "react-icons/io5";
import { FaChurch } from "react-icons/fa6";
import { logoutAction } from "../../redux/slice/authSlice";
import { logoutAPI } from "../../services/users/userService";
import { useWorkspace } from "../../hooks/useWorkspace";
import WorkspaceSwitcher from "../Workspaces/WorkspaceSwitcher";

export default function PrivateNavbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useSelector((state) => state.auth.user);
  const { can } = useWorkspace();

  const logoutHandler = async () => {
    try {
      //! Limpia también la cookie httpOnly en el servidor
      await logoutAPI();
    } catch {
      // aunque falle la llamada, la sesión local se cierra igual
    }
    dispatch(logoutAction());
    //! Sin esto, quien entre después en el mismo dispositivo vería por un
    //! instante los datos en caché de la sesión anterior
    queryClient.clear();
    navigate("/", { replace: true });
  };

  //! Solo se muestran los enlaces que el rol en este espacio permite usar
  const links = [
    { to: "/dashboard", label: "Panel" },
    can("tx:write") && { to: "/add-transaction", label: "Agregar movimiento" },
    { to: "/categories", label: "Categorías" },
    { to: "/espacio/miembros", label: "Miembros" },
    can("audit:read") && { to: "/espacio/historial", label: "Historial" },
    { to: "/espacios", label: "Espacios" },
    { to: "/profile", label: "Perfil" },
    user?.role === "admin" && {
      to: "/admin/users",
      label: "Admin",
      color: "text-red-600 hover:text-red-800",
    },
  ].filter(Boolean);

  return (
    <Disclosure as="nav" className="bg-white shadow-sm sticky top-0 z-10">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Link to="/dashboard" aria-label="Inicio" className="shrink-0">
                  <FaChurch className="h-8 w-auto text-blue-500" />
                </Link>
                <WorkspaceSwitcher />
              </div>

              {/* Menú en escritorio */}
              <div className="hidden lg:flex items-center gap-5">
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={link.color || "text-gray-700 hover:text-blue-600"}
                  >
                    {link.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={logoutHandler}
                  className="inline-flex items-center gap-2 px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700"
                >
                  <IoLogOutOutline className="h-5 w-5" />
                  Salir
                </button>
              </div>

              {/* Botón hamburguesa en móvil */}
              <div className="lg:hidden">
                <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 focus:outline-none">
                  <span className="sr-only">Abrir menú</span>
                  {open ? (
                    <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          {/* Menú en móvil */}
          <Disclosure.Panel className="lg:hidden px-4 pt-2 pb-3 space-y-1">
            {links.map((link) => (
              <MobileLink key={link.to} to={link.to} label={link.label} color={link.color} />
            ))}
            <button
              type="button"
              onClick={logoutHandler}
              className="block w-full text-left px-4 py-2 text-base font-medium text-red-600 hover:bg-gray-100"
            >
              Salir
            </button>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}

// Componente para enlaces móviles
const MobileLink = ({ to, label, color = "text-gray-700" }) => (
  <Link to={to}>
    <Disclosure.Button
      as="span"
      className={`block w-full px-4 py-2 text-base font-medium hover:bg-gray-100 ${color}`}
    >
      {label}
    </Disclosure.Button>
  </Link>
);
