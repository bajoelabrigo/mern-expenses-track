import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

//! Protege rutas privadas. Si no hay sesión guarda la ruta pedida para
//! volver a ella después del login.
//! También guarda el ESPACIO en el que estaba: sin eso, al volver a entrar la
//! app abre el predeterminado y devuelve a la misma pantalla, pero de otro
//! espacio (Miembros de la iglesia pasaba a ser Miembros de "Mis finanzas"), y
//! lo que se hiciera ahí acababa en el libro equivocado.
const AuthRoute = ({ children }) => {
  const user = useSelector((state) => state.auth.user);
  const workspaceId = useSelector((state) => state.workspace.currentId);
  const location = useLocation();

  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname, workspaceId }} />
    );
  }

  return children;
};

export default AuthRoute;
