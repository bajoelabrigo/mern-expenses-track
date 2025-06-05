import React, { useEffect } from "react";
import { FaUser, FaEnvelope, FaLock, FaChurch } from "react-icons/fa";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { registerAPI } from "../../services/users/userService";
import { useNavigate } from "react-router-dom";
import AlertMessage from "../Alert/AlertMessage";

//Validations
const validationSchema = Yup.object({
  username: Yup.string().required("Username is required"),
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
  iglesia: Yup.string().required("Iglesia is required"),
  password: Yup.string()
    .min(6, "Password must be at least 6 characters long")
    .required("Password is required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password"), null], "Passwords must match")
    .required("Confirming your password is required"),
});

const RegistrationForm = () => {
  //Navigate
  const navigate = useNavigate();
  //Mutation
  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: registerAPI,
    mutationKey: ["register"],
  });

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
      username: "",
      iglesia: "",
    },
    //Validations
    validationSchema,
    //Submit
    onSubmit: (values) => {
      console.log(values);
      //http request
      mutateAsync(values)
        .then((data) => {
          console.log(data);
        })
        .catch((e) => console.log(e));
    },
  });

  //Redirect
  useEffect(() => {
    setTimeout(() => {
      if (isSuccess) {
        navigate("/login");
      }
    }, 1000);
  }, [isPending, isError, error, isSuccess]);

  return (
    <form
      onSubmit={formik.handleSubmit}
      className="max-w-md mx-auto my-10 bg-white p-6 rounded-xl shadow-lg space-y-4 border border-gray-200"
    >
      <h2 className="text-3xl font-semibold text-center text-gray-800">
        Registrar
      </h2>
      {/* Display messages */}
      {isPending && <AlertMessage type="loading" message="Cargando..." />}
      {isError && (
        <AlertMessage type="error" message={error.response.data.message} />
      )}
      {isSuccess && <AlertMessage type="success" message="Registro exitoso" />}
      <p className="text-sm text-center text-gray-500">
        ¡Únete a nuestra comunidad ahora!
      </p>

      <div className="relative">
        <FaUser className="absolute top-3 left-3 text-gray-400" />
        <input
          id="username"
          type="username"
          {...formik.getFieldProps("username")}
          placeholder="Username"
          className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500"
        />
        {formik.touched.username && formik.errors.username && (
          <span className="text-xs text-red-500">{formik.errors.username}</span>
        )}
      </div>

      {/* Input Field - Email */}
      <div className="relative">
        <FaEnvelope className="absolute top-3 left-3 text-gray-400" />
        <input
          id="email"
          type="email"
          {...formik.getFieldProps("email")}
          placeholder="Email"
          className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500"
        />
        {formik.touched.email && formik.errors.email && (
          <span className="text-xs text-red-500">{formik.errors.email}</span>
        )}
      </div>

      {/* Input Field - Iglesia */}
      <div className="relative">
        <FaChurch size={20} className="absolute top-3 left-3 text-gray-400" />
        <input
          id="iglesia"
          type="text"
          {...formik.getFieldProps("iglesia")}
          placeholder="Iglesia o Ministerio"
          className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500"
        />
        {formik.touched.iglesia && formik.errors.iglesia && (
          <span className="text-xs text-red-500">{formik.errors.iglesia}</span>
        )}
      </div>

      {/* Input Field - Password */}
      <div className="relative">
        <FaLock className="absolute top-3 left-3 text-gray-400" />
        <input
          type="password"
          id="password"
          {...formik.getFieldProps("password")}
          placeholder="Password"
          className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500"
        />
        {formik.touched.password && formik.errors.password && (
          <span className="text-xs text-red-500">{formik.errors.password}</span>
        )}
      </div>

      {/* Input Field - Confirm Password */}
      <div className="relative">
        <FaLock className="absolute top-3 left-3 text-gray-400" />
        <input
          id="confirmPassword"
          type="password"
          {...formik.getFieldProps("confirmPassword")}
          placeholder="Confirmar Contraseña"
          className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:border-blue-500"
        />
        {formik.touched.confirmPassword && formik.errors.confirmPassword && (
          <span className="text-xs text-red-500">
            {formik.errors.confirmPassword}
          </span>
        )}
      </div>
      {/* Submit Button */}
      <button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
      >
        Registrar
      </button>
    </form>
  );
};

export default RegistrationForm;
