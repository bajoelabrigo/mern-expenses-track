import {
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
  AiOutlineLoading3Quarters,
} from "react-icons/ai";

//! Estilos por tipo de mensaje (el error usa rojo, antes heredaba el verde del success)
const estilos = {
  error: {
    icon: <AiOutlineCloseCircle className="text-red-600 text-2xl" />,
    classes: "bg-red-100 text-red-800 border-l-4 border-red-600",
  },
  success: {
    icon: <AiOutlineCheckCircle className="text-green-600 text-2xl" />,
    classes: "bg-green-100 text-green-800 border-l-4 border-green-600",
  },
  loading: {
    icon: (
      <AiOutlineLoading3Quarters className="animate-spin text-blue-600 text-2xl" />
    ),
    classes: "bg-blue-100 text-blue-800 border-l-4 border-blue-600",
  },
};

const AlertMessage = ({ type, message }) => {
  const { icon = null, classes = "" } = estilos[type] || {};

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`flex items-center p-4 rounded-lg shadow-md space-x-3 ${classes}`}
    >
      {icon}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};

export default AlertMessage;
