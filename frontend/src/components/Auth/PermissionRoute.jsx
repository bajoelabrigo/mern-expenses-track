import { Navigate } from "react-router-dom";
import { useWorkspace } from "../../hooks/useWorkspace";
import AlertMessage from "../Alert/AlertMessage";

//! Guarda de UI por permiso del rol en el espacio actual (p. ej. un lector no
//! ve el formulario de alta). La autorización real la hace el backend: esto
//! solo evita pantallas que igualmente devolverían 403.
//!
//! `permission` puede ser una lista: basta con tener uno (como
//! `requireAnyPermission` en el servidor). `redirectTo` es a dónde va quien no
//! pasa: el Inicio, salvo que ese sea justo el que no puede ver.
const PermissionRoute = ({ permission, redirectTo = "/dashboard", children }) => {
  const { workspace, can } = useWorkspace();

  if (!workspace) {
    return <AlertMessage type="loading" message="Cargando espacio..." />;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];
  if (!permissions.some((p) => can(p))) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export default PermissionRoute;
