import AppLogo from "../layout/AppLogo";
import { Card } from "../ui";

//! Marco común de las pantallas de acceso (entrar, crear cuenta, contraseña)
const AuthShell = ({ title, subtitle, children, footer }) => (
  <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10">
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <AppLogo size="lg" className="mx-auto" />
        <h1 className="mt-4 text-[26px] font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <Card className="p-6 space-y-4">{children}</Card>
      {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
    </div>
  </div>
);

export default AuthShell;
