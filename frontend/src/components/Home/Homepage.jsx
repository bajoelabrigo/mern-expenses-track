import React from "react";
import {
  FaChartPie,
  FaList,
  FaMoneyBillWave,
  FaQuoteLeft,
  FaSignInAlt,
} from "react-icons/fa";
import { IoIosStats } from "react-icons/io";
import { FaFilter } from "react-icons/fa6";
import { Link } from "react-router-dom";

const HeroSection = () => {
  return (
    <>
      <div className="bg-gradient-to-r from-green-400 to-blue-500 text-white py-20 px-4">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          {/* Título principal */}
          <h1 className="text-5xl font-bold text-center">
            Controla tus gastos sin esfuerzo
          </h1>

          {/* Subtítulo */}
          <p className="mt-4 text-xl text-center">
            Administra tus finanzas con una solución moderna diseñada para ti.
          </p>

          {/* Iconos de funciones */}
          <div className="flex space-x-8 mt-10">
            <div className="flex flex-col items-center">
              <FaMoneyBillWave className="text-3xl" />
              <p className="mt-2">Registro eficiente</p>
            </div>
            <div className="flex flex-col items-center">
              <FaFilter className="text-3xl" />
              <p className="mt-2">Filtrado de transacciones</p>
            </div>
            <div className="flex flex-col items-center">
              <IoIosStats className="text-3xl" />
              <p className="mt-2">Reportes detallados</p>
            </div>
          </div>

          {/* Botón de llamada a la acción */}
          <Link to="/register">
            <button className="mt-8 px-6 cursor-pointer py-3 bg-white text-green-500 font-semibold rounded-lg shadow-md hover:bg-gray-100 transition duration-300">
              Comienza ahora
            </button>
          </Link>
        </div>
      </div>

      {/* Cómo funciona */}
      <div className="py-20 px-4">
        <h2 className="text-3xl font-bold text-center text-gray-800">
          ¿Cómo funciona?
        </h2>
        <div className="mt-10 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Paso 1 */}
          <div className="flex flex-col items-center text-center">
            <div className="p-4 rounded-full bg-blue-500 text-white mb-4">
              <FaSignInAlt className="text-xl" />
            </div>
            <h3 className="mb-2 font-semibold">Crea una cuenta</h3>
            <p>Regístrate y empieza a controlar tus gastos en un minuto.</p>
          </div>
          {/* Paso 2 */}
          <div className="flex flex-col items-center text-center">
            <div className="p-4 rounded-full bg-green-500 text-white mb-4">
              <FaList className="text-xl" />
            </div>
            <h3 className="mb-2 font-semibold">Agrega transacciones</h3>
            <p>Registra tus ingresos y gastos de forma rápida y sencilla.</p>
          </div>
          {/* Paso 3 */}
          <div className="flex flex-col items-center text-center">
            <div className="p-4 rounded-full bg-yellow-500 text-white mb-4">
              <FaChartPie className="text-xl" />
            </div>
            <h3 className="mb-2 font-semibold">Visualiza reportes</h3>
            <p>Consulta gráficos y reportes detallados de tus finanzas.</p>
          </div>
        </div>
      </div>

      {/* Testimonios */}
      <div className="bg-gray-100 py-20 px-4">
        <h2 className="text-3xl font-bold text-center text-gray-800">
          Lo que dicen nuestros usuarios
        </h2>
        <div className="mt-10 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <FaQuoteLeft className="text-xl text-gray-400" />
            <p>
              "Esta app ha revolucionado la forma en que controlo mis gastos.
              Súper intuitiva y fácil de usar."
            </p>
            <p className="mt-4 font-bold">- Jane Doe</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <FaQuoteLeft className="text-xl text-gray-400" />
            <p className="mt-4">
              "Finalmente una forma sencilla de manejar mis finanzas. ¡Los
              reportes son una maravilla!"
            </p>
            <p className="mt-4 font-bold">- John Smith</p>
          </div>
        </div>
      </div>

      {/* Último llamado a la acción */}
      <div className="bg-blue-500 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold">¿Listo para tomar el control?</h2>
          <p className="mt-4">
            Únete ahora y empieza a gestionar tus gastos como un profesional.
          </p>
          <Link to="/register">
            <button className="mt-8 cursor-pointer px-6 py-3 bg-white text-blue-500 font-semibold rounded-lg shadow-md hover:bg-gray-100 transition duration-300">
              Regístrate gratis
            </button>
          </Link>
        </div>
      </div>
    </>
  );
};

export default HeroSection;
