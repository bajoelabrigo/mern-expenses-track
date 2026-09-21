import { useLocation } from "react-router-dom";
import { LuMessageCircle } from "react-icons/lu";
import { CONTACTO, enlaceDeAyuda, pantallaDe } from "../../lib/ayuda";
import { buttonClass, cx } from "../ui/styles";

//! "¿Te trabaste?", para escribirle a Jorge SIN salir de donde se trabó.
//!
//! `compacto` es el botón redondo con el ícono, para las pantallas que ocupan
//! todo el ancho (registrar) y no tienen barra de abajo. Sin `compacto` es la
//! fila con texto, para el menú.
//!
//! Si no hay número configurado no se pinta nada: mejor que no aparezca a que
//! aparezca un botón que no lleva a ninguna parte.
const AyudaBoton = ({ donde, className = "", compacto = false }) => {
  const location = useLocation();
  const enPantalla = donde || pantallaDe(location.pathname);
  const quien = CONTACTO.nombre || "";

  if (!CONTACTO.whatsapp) return null;

  if (compacto) {
    return (
      <a
        href={enlaceDeAyuda({ donde: enPantalla })}
        target="_blank"
        rel="noreferrer"
        title={`¿Te trabaste? Escríbele a ${quien || "quien te ayuda"}`}
        aria-label={`¿Te trabaste? Escríbele a ${quien || "quien te ayuda"} por WhatsApp`}
        className={cx(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink",
          className
        )}
      >
        <LuMessageCircle aria-hidden="true" className="text-xl" />
      </a>
    );
  }

  return (
    <a
      href={enlaceDeAyuda({ donde: enPantalla })}
      target="_blank"
      rel="noreferrer"
      className={cx(buttonClass({ variant: "secondary", size: "sm" }), className)}
    >
      <LuMessageCircle aria-hidden="true" /> ¿Te trabaste?
    </a>
  );
};

export default AyudaBoton;
