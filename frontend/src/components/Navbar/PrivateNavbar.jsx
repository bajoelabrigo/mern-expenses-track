import { Fragment } from "react";
import { Disclosure, Menu, Transition } from "@headlessui/react";
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
    <Disclosure as="nav" className="bg-white">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between items-center">
              <div className="flex items-center gap-6">
                <FaChurch className="h-8 w-auto text-blue-500" />
                <Link to="/" className="text-lg font-semibold text-gray-800">
                  Sistema Contable Iglesia
                </Link>
                <div className="hidden md:flex gap-6">
                  <Link to="/add-transaction" className="nav-link">
                    Agregar Transacción
                  </Link>
                  <Link to="/add-category" className="nav-link">
                    Agregar Categoría
                  </Link>
                  <Link to="/categories" className="nav-link">
                    Categorías
                  </Link>
                  <Link to="/profile" className="nav-link">
                    Perfil
                  </Link>
                  <Link to="/dashboard" className="nav-link">
                    Panel de Control
                  </Link>

                  {user?.role === "admin" && (
                    <>
                      <Link to="/admin/users" className="nav-link text-red-600">
                        Lista de Usuarios
                      </Link>
                      <Link
                        to="/admin/dashboard"
                        className="nav-link text-red-600"
                      >
                        Panel Admin
                      </Link>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center">
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

          {/* Mobile Navigation */}
          <Disclosure.Panel className="md:hidden px-4 pt-2 pb-3 space-y-1">
            <Link to="/add-transaction">
              <Disclosure.Button className="mobile-link">
                Agregar Transacción
              </Disclosure.Button>
            </Link>
            <Link to="/add-category">
              <Disclosure.Button className="mobile-link">
                Agregar Categoría
              </Disclosure.Button>
            </Link>
            <Link to="/categories">
              <Disclosure.Button className="mobile-link">
                Categorías
              </Disclosure.Button>
            </Link>
            <Link to="/profile">
              <Disclosure.Button className="mobile-link">
                Perfil
              </Disclosure.Button>
            </Link>
            <Link to="/dashboard">
              <Disclosure.Button className="mobile-link">
                Panel de Control
              </Disclosure.Button>
            </Link>

            {user?.role === "admin" && (
              <>
                <Link to="/admin/users">
                  <Disclosure.Button className="mobile-link text-red-600">
                    Lista de Usuarios
                  </Disclosure.Button>
                </Link>
                <Link to="/admin/dashboard">
                  <Disclosure.Button className="mobile-link text-red-600">
                    Panel Admin
                  </Disclosure.Button>
                </Link>
              </>
            )}

            <Disclosure.Button
              onClick={logoutHandler}
              className="block w-full text-left px-4 py-2 text-base font-medium text-gray-600 hover:bg-gray-100"
            >
              Salir
            </Disclosure.Button>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
