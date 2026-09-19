import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { forgotPasswordAPI } from "../../services/users/userService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";
import { Button, Field, Input } from "../ui";
import AuthShell from "./AuthShell";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const { mutate, isPending, isError, error, isSuccess, data } = useMutation({
    mutationFn: forgotPasswordAPI,
  });

  return (
    <AuthShell
      title="Recuperar la contraseña"
      subtitle="Te enviamos un enlace para elegir una nueva."
      footer={
        <Link to="/login" className="font-semibold text-ink underline underline-offset-4">
          Volver a entrar
        </Link>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutate({ email: email.trim() });
        }}
        className="space-y-4"
      >
        {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
        {isSuccess && (
          <AlertMessage type="success" message={`${data.message} Revisa también la carpeta de spam.`} />
        )}

        <Field label="Correo de tu cuenta" htmlFor="forgot-email">
          <Input
            id="forgot-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Button type="submit" block disabled={isPending}>
          {isPending ? "Enviando…" : "Enviar enlace"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default ForgotPassword;
