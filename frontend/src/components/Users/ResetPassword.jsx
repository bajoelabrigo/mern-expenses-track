import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { FaLock } from "react-icons/fa";
import { resetPasswordAPI } from "../../services/users/userService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";

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
      <div className="max-w-md mx-auto my-10 bg-white p-6 rounded-lg space-y-5 border border-gray-200 text-center">
        <AlertMessage type="success" message={data.message} />
        <Link
          to="/login"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto my-10 bg-white p-6 rounded-lg space-y-5 border border-gray-200"
    >
      <h2 className="text-2xl font-semibold text-center text-gray-800">Nueva contraseña</h2>

      {localError && <AlertMessage type="error" message={localError} />}
      {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
      {isError && error?.response?.data?.code === "INVALID_RESET_TOKEN" && (
        <p className="text-sm text-center">
          <Link to="/olvide-contrasena" className="text-blue-600 hover:underline">
            Pedir un enlace nuevo
          </Link>
        </p>
      )}

      {[
        { id: "new-password", value: password, set: setPassword, label: "Contraseña nueva (mínimo 8 caracteres)" },
        { id: "confirm-password", value: confirm, set: setConfirm, label: "Repite la contraseña" },
      ].map((field) => (
        <div key={field.id} className="relative">
          <FaLock className="absolute top-3 left-3 text-gray-400" />
          <input
            id={field.id}
            type="password"
            autoComplete="new-password"
            value={field.value}
            onChange={(e) => field.set(e.target.value)}
            placeholder={field.label}
            aria-label={field.label}
            className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500"
          />
        </div>
      ))}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-bold py-2 px-4 rounded-md disabled:opacity-60"
      >
        {isPending ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
};

export default ResetPassword;
