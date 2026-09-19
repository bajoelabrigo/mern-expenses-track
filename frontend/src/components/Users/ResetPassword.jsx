import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { resetPasswordAPI } from "../../services/users/userService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";
import { Button, ButtonLink, Field, Input } from "../ui";
import AuthShell from "./AuthShell";

const MIN_LENGTH = 8;

//! /restablecer-contrasena/:token — se abre desde el correo
const ResetPassword = () => {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");

  const { mutate, isPending, isError, error, isSuccess, data } = useMutation({
    mutationFn: resetPasswordAPI,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password.length < MIN_LENGTH) {
      setLocalError(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres`);
      return;
    }
    if (password !== confirm) {
      setLocalError("Las contraseñas no coinciden");
      return;
    }
    setLocalError("");
    mutate({ token, password });
  };

  if (isSuccess) {
    return (
      <AuthShell title="Contraseña actualizada">
        <AlertMessage type="success" message={data.message} />
        <ButtonLink to="/login" block>
          Entrar
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nueva contraseña" subtitle="Elige una que no uses en otro sitio.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {localError && <AlertMessage type="error" message={localError} />}
        {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
        {isError && error?.response?.data?.code === "INVALID_RESET_TOKEN" && (
          <p className="text-sm text-center">
            <Link to="/olvide-contrasena" className="font-semibold text-ink underline underline-offset-4">
              Pedir un enlace nuevo
            </Link>
          </p>
        )}

        <Field label="Contraseña nueva" htmlFor="new-password" hint="Mínimo 8 caracteres.">
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Repite la contraseña" htmlFor="confirm-password">
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>

        <Button type="submit" block disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default ResetPassword;
