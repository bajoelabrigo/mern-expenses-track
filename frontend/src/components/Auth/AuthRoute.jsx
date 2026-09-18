import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

//! Protege rutas privadas. Si no hay sesión guarda la ruta pedida para
//! volver a ella después del login.
const AuthRoute = ({ children }) => {
  const user = useSelector((state) => state.auth.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default AuthRoute;
