import { Navigate } from "react-router-dom";
import { useWorkspace } from "../../hooks/useWorkspace";
import AlertMessage from "../Alert/AlertMessage";

//! Guarda de UI por permiso del rol en el espacio actual (p. ej. un lector no
//! ve el formulario de alta). La autorización real la hace el backend: esto
//! solo evita pantallas que igualmente devolverían 403.
const PermissionRoute = ({ permission, children }) => {
  const { workspace, can } = useWorkspace();

  if (!workspace) {
    return <AlertMessage type="loading" message="Cargando espacio..." />;
  }

  if (!can(permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PermissionRoute;
