import { Link } from "react-router-dom";
import { LuHeart } from "react-icons/lu";
import { isAndroidApp } from "../../lib/platform";
import { buttonClass } from "../ui/styles";

//! Invitación a hacerse socio, al final de la barra lateral.
//!
//! Es un botón y no una tarjeta con su explicación: el menú ya es largo y la
//! explicación está en /socio, que es a donde lleva. Va en su propio color
//! (bg-support) para que no se confunda con el ámbar de "Registrar".
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
      <LuHeart aria-hidden="true" /> Hazte socio
    </Link>
  );
};

export default SupportCard;
