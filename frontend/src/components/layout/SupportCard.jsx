import { Link } from "react-router-dom";
import { isAndroidApp } from "../../lib/platform";

//! Invitación a hacerse socio, al final de la barra lateral.
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
      className="block rounded-card bg-ink text-surface px-4 py-3 hover:brightness-110 transition"
    >
      <p className="text-xs leading-relaxed opacity-80">
        Gratis para tu iglesia, siempre. Mantenerla cuesta.
      </p>
      <span className="mt-2.5 inline-flex h-8 items-center rounded-full bg-accent px-3 text-xs font-bold text-accent-ink">
        Hazte socio
      </span>
    </Link>
  );
};

export default SupportCard;
