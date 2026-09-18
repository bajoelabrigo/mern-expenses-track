import { FaUserCircle, FaEnvelope } from "react-icons/fa";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { useDispatch, useSelector } from "react-redux";
import { updateProfileAPI } from "../../services/users/userService";
import { updateUserAction } from "../../redux/slice/authSlice";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";

const validationSchema = Yup.object({
  username: Yup.string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .required("El nombre de usuario es obligatorio"),
  email: Yup.string()
    .email("Correo inválido")
    .required("El correo es obligatorio"),
});

export default function ProfileForm() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: updateProfileAPI,
    mutationKey: ["update-profile"],
  });

  const formik = useFormik({
    //! Se precargan los datos actuales para no enviar campos vacíos
    initialValues: {
      email: user?.email || "",
      username: user?.username || "",
    },
    enableReinitialize: true,
    validationSchema,
    onSubmit: async (values) => {
      try {
        const data = await mutateAsync(values);
        //! Mantiene sincronizados Redux y localStorage con los datos nuevos
        if (data?.user) dispatch(updateUserAction(data.user));
      } catch {
        // el mensaje se muestra con AlertMessage
      }
    },
  });

  return (
    <div className="max-w-2xl mx-auto my-10 p-8 bg-white rounded-lg shadow-md">
      <h1 className="mb-2 text-2xl text-center font-extrabold">
        Bienvenido {user?.username}
      </h1>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        Actualizar perfil
      </h3>

      {isPending && <AlertMessage type="loading" message="Actualizando..." />}
      {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
      {isSuccess && (
        <AlertMessage type="success" message="Perfil actualizado con éxito" />
      )}

      <form onSubmit={formik.handleSubmit} className="space-y-6">
        <div className="flex items-center space-x-4">
          <FaUserCircle className="text-3xl text-gray-400" />
          <div className="flex-1">
            <label
              htmlFor="username"
              className="text-sm font-medium text-gray-700"
            >
              Nombre de usuario
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              {...formik.getFieldProps("username")}
              className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:border-blue-500"
            />
            {formik.touched.username && formik.errors.username && (
              <span className="text-xs text-red-500">
                {formik.errors.username}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <FaEnvelope className="text-3xl text-gray-400" />
          <div className="flex-1">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...formik.getFieldProps("email")}
              className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:border-blue-500"
            />
            {formik.touched.email && formik.errors.email && (
              <span className="text-xs text-red-500">
                {formik.errors.email}
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-60"
        >
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
