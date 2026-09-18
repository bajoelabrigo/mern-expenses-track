import { AiOutlineLock } from "react-icons/ai";
import { useMutation } from "@tanstack/react-query";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { changePasswordAPI } from "../../services/users/userService";
import { logoutAction } from "../../redux/slice/authSlice";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";

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

  const campo = (name, label, placeholder, autoComplete) => (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-2" htmlFor={name}>
        {label}
      </label>
      <div className="flex items-center border-2 shadow border-gray-400 py-2 px-3 rounded">
        <AiOutlineLock className="text-gray-400 mr-2" />
        <input
          id={name}
          type="password"
          autoComplete={autoComplete}
          {...formik.getFieldProps(name)}
          className="outline-none flex-1"
          placeholder={placeholder}
        />
      </div>
      {formik.touched[name] && formik.errors[name] && (
        <span className="text-xs text-red-500">{formik.errors[name]}</span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <h2 className="text-lg font-semibold mb-4">Cambiar contraseña</h2>
      <form onSubmit={formik.handleSubmit} className="w-full max-w-xs">
        {isPending && <AlertMessage type="loading" message="Actualizando..." />}
        {isError && (
          <AlertMessage type="error" message={getErrorMessage(error)} />
        )}
        {isSuccess && (
          <AlertMessage
            type="success"
            message="Contraseña actualizada. Vuelve a iniciar sesión."
          />
        )}

        {campo(
          "currentPassword",
          "Contraseña actual",
          "Tu contraseña actual",
          "current-password"
        )}
        {campo(
          "newPassword",
          "Nueva contraseña",
          "Mínimo 8 caracteres",
          "new-password"
        )}
        {campo(
          "confirmPassword",
          "Confirmar nueva contraseña",
          "Repite la nueva contraseña",
          "new-password"
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-60"
        >
          Actualizar contraseña
        </button>
      </form>
    </div>
  );
};

export default UpdatePassword;
