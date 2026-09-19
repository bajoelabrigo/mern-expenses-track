import { useFormik } from "formik";
import * as Yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { useDispatch, useSelector } from "react-redux";
import { updateProfileAPI } from "../../services/users/userService";
import { updateUserAction } from "../../redux/slice/authSlice";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Field, Input } from "../ui";

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

  const error_ = (name) => formik.touched[name] && formik.errors[name];

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
      {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
      {isSuccess && <AlertMessage type="success" message="Datos guardados." />}

      <Field label="Nombre de usuario" htmlFor="username" error={error_("username")}>
        <Input id="username" autoComplete="username" {...formik.getFieldProps("username")} />
      </Field>

      <Field label="Correo" htmlFor="email" error={error_("email")}>
        <Input id="email" type="email" autoComplete="email" {...formik.getFieldProps("email")} />
      </Field>

      <Button type="submit" disabled={isPending || !formik.dirty}>
        {isPending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
