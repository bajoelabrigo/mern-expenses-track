import { useEffect } from "react";
import { FaUser, FaEnvelope, FaLock, FaChurch } from "react-icons/fa";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { registerAPI } from "../../services/users/userService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";
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
    <form
      onSubmit={formik.handleSubmit}
      className="max-w-md mx-auto my-10 bg-white p-6 rounded-xl shadow-lg space-y-4 border border-gray-200"
    >
      <h2 className="text-3xl font-semibold text-center text-gray-800">
        Registrarse
      </h2>

      {isPending && <AlertMessage type="loading" message="Creando cuenta..." />}
      {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
      {isSuccess && (
        <AlertMessage
          type="success"
          message="Registro exitoso, te llevamos al login..."
        />
      )}

      <p className="text-sm text-center text-gray-500">
        ¡Únete a nuestra comunidad ahora!
      </p>

      <div className="relative">
        <FaUser className="absolute top-3 left-3 text-gray-400" />
        <input
          id="username"
          type="text"
          autoComplete="username"
          {...formik.getFieldProps("username")}
          placeholder="Nombre de usuario"
          className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500"
        />
        {formik.touched.username && formik.errors.username && (
          <span className="text-xs text-red-500">{formik.errors.username}</span>
        )}
      </div>

      <div className="relative">
        <FaEnvelope className="absolute top-3 left-3 text-gray-400" />
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...formik.getFieldProps("email")}
          placeholder="Correo"
          className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500"
        />
        {formik.touched.email && formik.errors.email && (
          <span className="text-xs text-red-500">{formik.errors.email}</span>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={formik.values.llevaIglesia}
          onChange={(e) => formik.setFieldValue("llevaIglesia", e.target.checked)}
          className="mt-1"
        />
        <span>
          Voy a llevar las cuentas de una iglesia o ministerio
          <span className="block text-xs text-gray-500">
            Siempre tendrás además un espacio personal para tus finanzas.
          </span>
        </span>
      </label>

      {formik.values.llevaIglesia && (
        <div className="relative">
          <FaChurch size={20} className="absolute top-3 left-3 text-gray-400" />
          <input
            id="iglesia"
            type="text"
            {...formik.getFieldProps("iglesia")}
            placeholder="Nombre de la iglesia o ministerio"
            className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500"
          />
          {formik.touched.iglesia && formik.errors.iglesia && (
            <span className="text-xs text-red-500">{formik.errors.iglesia}</span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="currency" className="text-sm text-gray-700">
          Moneda en la que llevarás las cuentas
        </label>
        <select
          id="currency"
          {...formik.getFieldProps("currency")}
          className="py-2 px-3 w-full rounded-md border border-gray-300 focus:border-blue-500"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <FaLock className="absolute top-3 left-3 text-gray-400" />
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          {...formik.getFieldProps("password")}
          placeholder="Contraseña (mínimo 8 caracteres)"
          className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500"
        />
        {formik.touched.password && formik.errors.password && (
          <span className="text-xs text-red-500">{formik.errors.password}</span>
        )}
      </div>

      <div className="relative">
        <FaLock className="absolute top-3 left-3 text-gray-400" />
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...formik.getFieldProps("confirmPassword")}
          placeholder="Confirmar contraseña"
          className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500"
        />
        {formik.touched.confirmPassword && formik.errors.confirmPassword && (
          <span className="text-xs text-red-500">
            {formik.errors.confirmPassword}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-bold py-2 px-4 rounded-md focus:outline-none transition duration-150 ease-in-out disabled:opacity-60"
      >
        {isPending ? "Registrando..." : "Registrar"}
      </button>
    </form>
  );
};

export default RegistrationForm;
