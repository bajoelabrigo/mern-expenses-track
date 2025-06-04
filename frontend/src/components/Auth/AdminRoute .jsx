import { Navigate } from "react-router-dom";
import { getUserFromStorage } from "../../utils/getUserFromStorage";

const AdminRoute = ({ children }) => {
  const user = getUserFromStorage();
  if (user && user.role === "admin") {
    return children;
  }
  return <Navigate to="/dashboard" />;
};

export default AdminRoute;
