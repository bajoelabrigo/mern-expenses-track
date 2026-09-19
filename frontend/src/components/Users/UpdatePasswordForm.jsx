import { useMutation } from "@tanstack/react-query";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { changePasswordAPI } from "../../services/users/userService";
import { logoutAction } from "../../redux/slice/authSlice";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Field, Input } from "../ui";

const validationSchema = Yup.object({
  currentPassword: Yup.string().required("Ingresa tu contraseña actual"),
  newPassword: Yup.string()
    .min(8, "La nueva contraseña debe tener al menos 8 caracteres")
    .notOneOf(
      [Yup.ref("currentPassword")],
      "La nueva contraseña debe ser distinta de la actual"
    )
    .required("La nueva contraseña es obligatoria"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("newPassword")], "Las contraseñas no coinciden")
    .required("Debes confirmar la nueva contraseña"),
});

const FIELDS = [
  { name: "currentPassword", label: "Contraseña actual", autoComplete: "current-password" },
  { name: "newPassword", label: "Contraseña nueva", autoComplete: "new-password", hint: "Mínimo 8 caracteres." },
  { name: "confirmPassword", label: "Repite la contraseña nueva", autoComplete: "new-password" },
];

const UpdatePassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: changePasswordAPI,
    mutationKey: ["change-password"],
  });

  const formik = useFormik({
    initialValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    validationSchema,
    onSubmit: async ({ currentPassword, newPassword }) => {
      try {
        await mutateAsync({ currentPassword, newPassword });
        //! El backend invalida los tokens anteriores: hay que volver a entrar
        dispatch(logoutAction());
        navigate("/login", { replace: true });
      } catch {
        // el mensaje se muestra con AlertMessage
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted">
        Al cambiarla se cierra la sesión en todos tus dispositivos.
      </p>
      {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
      {isSuccess && (
        <AlertMessage type="success" message="Contraseña cambiada. Vuelve a entrar." />
      )}

      {FIELDS.map(({ name, label, autoComplete, hint }) => (
        <Field
          key={name}
          label={label}
          htmlFor={name}
          hint={hint}
          error={formik.touched[name] && formik.errors[name]}
        >
          <Input id={name} type="password" autoComplete={autoComplete} {...formik.getFieldProps(name)} />
        </Field>
      ))}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Cambiando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
};

export default UpdatePassword;
