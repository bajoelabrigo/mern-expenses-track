import { Fragment } from "react";
import { Disclosure } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { IoLogOutOutline } from "react-icons/io5";
import { FaChurch } from "react-icons/fa6";
import { logoutAction } from "../../redux/slice/authSlice";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function PrivateNavbar() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const logoutHandler = () => {
    dispatch(logoutAction());
    localStorage.removeItem("userInfo");
  };

  return (
    <Disclosure as="nav" className="bg-white shadow-sm sticky top-0 z-10">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between items-center">
              <div className="flex items-center gap-6">
                <FaChurch className="h-8 w-auto text-blue-500" />
                <Link to="/" className="text-lg font-semibold text-gray-800">
                  Sistema Contable Iglesia
                </Link>

                {/* Menú en escritorio */}
                <div className="hidden md:flex gap-6">
                  <Link
                    to="/add-transaction"
                    className="text-gray-700 hover:text-blue-600"
                  >
                    Agregar Transacción
                  </Link>
                  <Link
                    to="/add-category"
                    className="text-gray-700 hover:text-blue-600"
                  >
                    Agregar Categoría
                  </Link>
                  <Link
                    to="/categories"
                    className="text-gray-700 hover:text-blue-600"
                  >
                    Categorías
                  </Link>
                  <Link
                    to="/profile"
                    className="text-gray-700 hover:text-blue-600"
                  >
                    Perfil
                  </Link>
                  <Link
                    to="/dashboard"
                    className="text-gray-700 hover:text-blue-600"
                  >
                    Panel de Control
                  </Link>
                  {user?.role === "admin" && (
                    <Link
                      to="/admin/users"
                      className="text-red-600 hover:text-red-800"
                    >
                      Lista de Usuarios
                    </Link>
                  )}
                </div>
              </div>

              {/* Botón hamburguesa en móvil */}
              <div className="md:hidden">
                <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 focus:outline-none">
                  {open ? (
                    <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>

              {/* Botón salir en escritorio */}
              <div className="hidden md:flex items-center">
                <button
                  onClick={logoutHandler}
                  className="inline-flex items-center gap-2 px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700"
                >
                  <IoLogOutOutline className="h-5 w-5" />
                  Salir
                </button>
              </div>
            </div>
          </div>

          {/* Menú en móvil */}
          <Disclosure.Panel className="md:hidden px-4 pt-2 pb-3 space-y-1">
            <MobileLink to="/add-transaction" label="Agregar Transacción" />
            <MobileLink to="/add-category" label="Agregar Categoría" />
            <MobileLink to="/categories" label="Categorías" />
            <MobileLink to="/profile" label="Perfil" />
            <MobileLink to="/dashboard" label="Panel de Control" />
            {user?.role === "admin" && (
              <>
                <MobileLink
                  to="/admin/users"
                  label="Lista de Usuarios"
                  color="text-red-600"
                />
                <MobileLink
                  to="/admin/dashboard"
                  label="Panel Admin"
                  color="text-red-600"
                />
              </>
            )}
            <button
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
