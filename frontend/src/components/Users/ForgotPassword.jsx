import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { FaEnvelope } from "react-icons/fa";
import { forgotPasswordAPI } from "../../services/users/userService";
import { getErrorMessage } from "../../lib/axios";
import AlertMessage from "../Alert/AlertMessage";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const { mutate, isPending, isError, error, isSuccess, data } = useMutation({
    mutationFn: forgotPasswordAPI,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate({ email: email.trim() });
      }}
      className="max-w-md mx-auto my-10 bg-white p-6 rounded-lg space-y-5 border border-gray-200"
    >
      <h2 className="text-2xl font-semibold text-center text-gray-800">
        ¿Olvidaste tu contraseña?
      </h2>
      <p className="text-sm text-center text-gray-500">
        Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una nueva.
      </p>

      {isError && <AlertMessage type="error" message={getErrorMessage(error)} />}
      {isSuccess && (
        <AlertMessage
          type="success"
          message={`${data.message} Revisa también la carpeta de spam.`}
        />
      )}

      <div className="relative">
        <FaEnvelope className="absolute top-3 left-3 text-gray-400" />
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo"
          aria-label="Correo"
          className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-bold py-2 px-4 rounded-md disabled:opacity-60"
      >
        {isPending ? "Enviando..." : "Enviar enlace"}
      </button>

      <p className="text-sm text-center">
        <Link to="/login" className="text-blue-600 hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
};

export default ForgotPassword;
