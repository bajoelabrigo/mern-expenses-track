import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import { logoutAction } from "../redux/slice/authSlice";
import { logoutAPI } from "../services/users/userService";

//! Cerrar sesión: cookie del servidor, sesión local y datos en caché
export const useLogout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return async () => {
    try {
      await logoutAPI();
    } catch {
      //! Aunque falle la llamada, la sesión local se cierra igual
    }
    dispatch(logoutAction());
    //! Sin esto, quien entre después en el mismo dispositivo vería por un
    //! instante los datos en caché de la sesión anterior
    queryClient.clear();
    navigate("/", { replace: true });
  };
};

export default useLogout;
