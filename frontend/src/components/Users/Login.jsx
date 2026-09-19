import { useEffect } from "react";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginAPI } from "../../services/users/userService";
import { loginAction } from "../../redux/slice/authSlice";
import { getErrorMessage } from "../../lib/axios";
import { useEsperaLarga } from "../../hooks/useEsperaLarga";
import AlertMessage from "../Alert/AlertMessage";

const validationSchema = Yup.object({
  email: Yup.string()
    .email("Correo inválido")
    .required("El correo es obligatorio"),
  password: Yup.string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .required("La contraseña es obligatoria"),
});

const LoginForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  //! Página a la que volver tras entrar (una ruta privada o una invitación)
  const destino = location.state?.from || "/dashboard";
  const user = useSelector((state) => state.auth.user);

  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: loginAPI,
    mutationKey: ["login"],
  });

  //! El servidor gratuito puede tardar hasta un minuto en despertar
  const despertandoServidor = useEsperaLarga(isPending);

  const formik = useFormik({
    initialValues: {
      email: location.state?.email || "",
      password: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      //! El error se muestra con isError; aquí solo evitamos la promesa sin capturar
      try {
        const data = await mutateAsync(values);
        dispatch(loginAction(data)); // guarda token + usuario
      } catch {
        // mensaje mostrado por AlertMessage
      }
    },
  });

  //! Redirige cuando la sesión queda en Redux
  useEffect(() => {
    if (user) {
      navigate(destino, { replace: true });
    }
  }, [user, navigate, destino]);

  return (
    <form
      onSubmit={formik.handleSubmit}
      className="max-w-md mx-auto my-10 bg-white p-6 rounded-lg space-y-6 border border-gray-200"
    >
      <h2 className="text-3xl font-semibold text-center text-gray-800">
        Iniciar sesión
      </h2>

      {isPending && (
        <AlertMessage
          type="loading"
          message={
            despertandoServidor
              ? "El servidor está despertando, esto puede tardar hasta un minuto la primera vez..."
              : "Ingresando..."
          }
        />
      )}
      {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
      {isSuccess && (
        <AlertMessage type="success" message="Sesión iniciada correctamente" />
      )}

      <p className="text-sm text-center text-gray-500">
        Ingresa para acceder a tu cuenta
      </p>

      <div className="relative">
        <FaEnvelope className="absolute top-3 left-3 text-gray-400" />
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...formik.getFieldProps("email")}
          placeholder="Correo"
          className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
        />
        {formik.touched.email && formik.errors.email && (
          <span className="text-xs text-red-500">{formik.errors.email}</span>
        )}
      </div>

      <div className="relative">
        <FaLock className="absolute top-3 left-3 text-gray-400" />
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...formik.getFieldProps("password")}
          placeholder="Contraseña"
          className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
        />
        {formik.touched.password && formik.errors.password && (
          <span className="text-xs text-red-500">{formik.errors.password}</span>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-bold py-2 px-4 rounded-md focus:outline-none transition duration-150 ease-in-out disabled:opacity-60"
      >
        {isPending ? "Ingresando..." : "Ingresar"}
      </button>

      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link to="/olvide-contrasena" className="text-blue-600 hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link to="/register" state={location.state} className="text-blue-600 hover:underline">
          Crear una cuenta
        </Link>
      </div>
    </form>
  );
};

export default LoginForm;
