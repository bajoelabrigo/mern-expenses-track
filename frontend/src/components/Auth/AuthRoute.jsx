import React from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

const AuthRoute = ({ children }) => {
  const user = useSelector((state) => state.auth.user);

  if (user) {
    return children;
  } else {
    return <Navigate to="/login" />;
  }
};

export default AuthRoute;
