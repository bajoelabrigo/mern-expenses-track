import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { registerAPI } from "../../services/users/userService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Field, Input, Select } from "../ui";
import AuthShell from "./AuthShell";
import { CURRENCIES } from "../../lib/money";

const validationSchema = Yup.object({
  username: Yup.string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .required("El nombre de usuario es obligatorio"),
  email: Yup.string()
    .email("Correo inválido")
    .required("El correo es obligatorio"),
  //! La iglesia solo se pide si se marcó que se llevarán sus cuentas
  iglesia: Yup.string().when("llevaIglesia", {
    is: true,
    then: (schema) =>
      schema
        .trim()
        .min(2, "El nombre debe tener al menos 2 caracteres")
        .required("Escribe el nombre de la iglesia o ministerio"),
    otherwise: (schema) => schema.notRequired(),
  }),
  //! Mismo mínimo que exige el backend (8 caracteres)
  password: Yup.string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .required("La contraseña es obligatoria"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password")], "Las contraseñas no coinciden")
    .required("Debes confirmar la contraseña"),
});

const RegistrationForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  //! Quien llega desde una invitación ya tiene espacio al que unirse
  const invitado = Boolean(location.state?.invited);

  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: registerAPI,
    mutationKey: ["register"],
  });

  const formik = useFormik({
    initialValues: {
      username: "",
      email: location.state?.email || "",
      llevaIglesia: !invitado,
      iglesia: "",
      currency: "USD",
      password: "",
      confirmPassword: "",
    },
    validationSchema,
    onSubmit: async ({ username, email, llevaIglesia, iglesia, currency, password }) => {
      try {
        await mutateAsync({
          username,
          email,
          iglesia: llevaIglesia ? iglesia.trim() : "",
          currency,
          password,
        });
      } catch {
        // el mensaje se muestra con AlertMessage
      }
    },
  });

  //! Redirige al login tras un registro exitoso (con limpieza del temporizador)
  useEffect(() => {
    if (!isSuccess) return undefined;

    //! Se conserva a dónde volver (p. ej. la invitación) y el correo
    const timeout = setTimeout(
      () =>
        navigate("/login", {
          state: { from: location.state?.from, email: formik.values.email },
        }),
      1200
    );
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, navigate]);

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle={invitado ? "Crea tu cuenta para unirte al espacio al que te invitaron." : "Gratis. Tu espacio personal y, si quieres, el de tu iglesia."}
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" state={location.state} className="font-semibold text-ink underline underline-offset-4">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
        {isPending && <AlertMessage type="loading" message="Creando tu cuenta…" />}
        {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
        {isSuccess && <AlertMessage type="success" message="Cuenta creada. Te llevamos a entrar…" />}

        <Field label="Nombre de usuario" htmlFor="username" error={formik.touched.username && formik.errors.username}>
          <Input id="username" autoComplete="username" {...formik.getFieldProps("username")} />
        </Field>

        <Field label="Correo" htmlFor="email" error={formik.touched.email && formik.errors.email}>
          <Input id="email" type="email" autoComplete="email" {...formik.getFieldProps("email")} />
        </Field>

        <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formik.values.llevaIglesia}
            onChange={(e) => formik.setFieldValue("llevaIglesia", e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-[var(--ink)]"
          />
          <span className="text-sm">
            <span className="font-semibold text-ink">Llevaré las cuentas de una iglesia</span>
            <span className="block text-muted">Además tendrás un espacio para tus finanzas personales.</span>
          </span>
        </label>

        {formik.values.llevaIglesia && (
          <Field label="Nombre de la iglesia o ministerio" htmlFor="iglesia" error={formik.touched.iglesia && formik.errors.iglesia}>
            <Input id="iglesia" {...formik.getFieldProps("iglesia")} />
          </Field>
        )}

        <Field label="Moneda" htmlFor="currency">
          <Select id="currency" {...formik.getFieldProps("currency")}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Contraseña" htmlFor="password" hint="Mínimo 8 caracteres." error={formik.touched.password && formik.errors.password}>
          <Input id="password" type="password" autoComplete="new-password" {...formik.getFieldProps("password")} />
        </Field>

        <Field label="Repite la contraseña" htmlFor="confirmPassword" error={formik.touched.confirmPassword && formik.errors.confirmPassword}>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...formik.getFieldProps("confirmPassword")}
          />
        </Field>

        <Button type="submit" block disabled={isPending || isSuccess}>
          {isPending ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default RegistrationForm;
