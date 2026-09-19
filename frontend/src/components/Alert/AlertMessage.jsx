import { LuCircleAlert, LuCircleCheck, LuLoaderCircle } from "react-icons/lu";

//! Aviso de estado (error, éxito, cargando) con los colores del tema
const estilos = {
  error: {
    icon: <LuCircleAlert className="text-danger text-xl shrink-0" />,
    classes: "bg-danger-soft text-danger",
  },
  success: {
    icon: <LuCircleCheck className="text-income text-xl shrink-0" />,
    classes: "bg-income-soft text-income",
  },
  loading: {
    icon: <LuLoaderCircle className="animate-spin text-muted text-xl shrink-0" />,
    classes: "bg-surface-2 text-ink-2",
  },
};

const AlertMessage = ({ type, message }) => {
  const { icon = null, classes = "" } = estilos[type] || {};

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${classes}`}
    >
      {icon}
      <span className="text-sm font-semibold">{message}</span>
    </div>
  );
};

export default AlertMessage;
