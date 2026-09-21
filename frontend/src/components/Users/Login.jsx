import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginAPI } from "../../services/users/userService";
import { loginAction } from "../../redux/slice/authSlice";
import { setWorkspaceAction } from "../../redux/slice/workspaceSlice";
import { getErrorMessage } from "../../lib/axios";
import { useEsperaLarga } from "../../hooks/useEsperaLarga";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Field, Input } from "../ui";
import AuthShell from "./AuthShell";

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
  const queryClient = useQueryClient();
  //! Página a la que volver tras entrar (una ruta privada o una invitación)
  const destino = location.state?.from || "/dashboard";
  //! Y el espacio en el que estabas: se recupera para no aterrizar en la misma
  //! pantalla pero con otro espacio cargado (ver AuthRoute)
  const espacioPrevio = location.state?.workspaceId || null;
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
        //! Nada de lo que hubiera en caché (otra cuenta en este dispositivo)
        //! debe verse con la sesión nueva
        queryClient.clear();
        dispatch(loginAction(data)); // guarda token + usuario
        //! Y se vuelve al espacio donde estabas, no al predeterminado: si no,
        //! la pantalla que se restaura sería la de otro espacio
        if (espacioPrevio) dispatch(setWorkspaceAction(espacioPrevio));
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
    <AuthShell
      title="Entrar"
      subtitle="Las cuentas de tu iglesia y las tuyas, en un solo lugar."
      footer={
        <>
          ¿Aún no tienes cuenta?{" "}
          <Link to="/register" state={location.state} className="font-semibold text-ink underline underline-offset-4">
            Crear una cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
        {isPending && (
          <AlertMessage
            type="loading"
            message={
              despertandoServidor
                ? "El servidor está despertando; la primera vez puede tardar hasta un minuto…"
                : "Entrando…"
            }
          />
        )}
        {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}

        <Field label="Correo" htmlFor="email" error={formik.touched.email && formik.errors.email}>
          <Input id="email" type="email" autoComplete="email" {...formik.getFieldProps("email")} />
        </Field>

        <Field
          label="Contraseña"
          htmlFor="password"
          error={formik.touched.password && formik.errors.password}
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...formik.getFieldProps("password")}
          />
        </Field>

        <Button type="submit" block disabled={isPending || isSuccess}>
          {isPending ? "Entrando…" : "Entrar"}
        </Button>

        <p className="text-center">
          <Link to="/olvide-contrasena" className="text-sm font-semibold text-muted hover:text-ink">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default LoginForm;
