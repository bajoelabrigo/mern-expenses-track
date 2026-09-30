import { Link } from "react-router-dom";
import { LuHeart } from "react-icons/lu";
import { isAndroidApp } from "../../lib/platform";
import { buttonClass } from "../ui/styles";

//! Invitación a hacerse socio, al final de la barra lateral.
//!
//! Es un botón y no una tarjeta con su explicación: el menú ya es largo y la
//! explicación está en /socio, que es a donde lleva. Va en su propio color (el
//! degradado violeta de --support, el mismo de chat-app) para que no se
//! confunda con el ámbar de "Registrar".
//!
//! No se muestra dentro de la app de Android: la política de pagos de Google
//! Play prohíbe que una app de su tienda lleve al usuario a pagar por fuera,
//! y esto se cobra con PayPal. Ver lib/platform.js.
const SupportCard = ({ onNavigate }) => {
  if (isAndroidApp()) return null;

  return (
    <Link
      to="/socio"
      onClick={onNavigate}
      className={buttonClass({ variant: "support", size: "sm", block: true })}
    >
      {/* Relleno en vez de contorno: a 15px un corazón de línea es casi todo
          fondo y apenas se lee. Hereda el blanco del texto del botón. */}
      <LuHeart aria-hidden="true" fill="currentColor" stroke="none" /> Hazte socio
    </Link>
  );
};

export default SupportCard;
