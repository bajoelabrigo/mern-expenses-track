import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

//! Guarda de UI para el panel de administración.
//! La autorización real la hace el backend (middleware isAdmin): esto solo
//! evita mostrar pantallas que igualmente devolverían 403.
const AdminRoute = ({ children }) => {
  const user = useSelector((state) => state.auth.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default AdminRoute;
