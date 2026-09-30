import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

//! Lo contrario de AuthRoute: páginas que solo tienen sentido SIN sesión.
//!
//! La portada explica qué es la app y ofrece crear una cuenta; a quien ya entró
//! no le dice nada. Y quedaba peor aún de lo que suena: la barra lateral sí
//! mira la sesión (ver layout/AppNav.jsx), así que se veía el menú de la app
//! alrededor de una página que invitaba a registrarse.
//!
//! Se manda a /dashboard, que es a donde ya llevaba entrar (ver Login.jsx): no
//! es una decisión nueva, es la misma en otro sitio.
const GuestRoute = ({ children }) => {
  const user = useSelector((state) => state.auth.user);

  //! La sesión guardada se lee al crear el slice, no después, así que aquí ya
  //! se sabe si la hay: no hay parpadeo de la portada antes de redirigir.
  if (user) return <Navigate to="/dashboard" replace />;

  return children;
};

export default GuestRoute;
