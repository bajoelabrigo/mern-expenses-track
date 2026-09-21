import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { LuListChecks, LuLogOut } from "react-icons/lu";
import { useLogout } from "../../hooks/useLogout";
import { useWorkspace } from "../../hooks/useWorkspace";
import { showGuide } from "../../lib/welcomeGuide";
import ThemeToggle from "../layout/ThemeToggle";
import { Button, Card } from "../ui";
import { initials } from "../ui/styles";
import ProfileForm from "./ProfileForm";
import UpdatePasswordForm from "./UpdatePasswordForm";

const Section = ({ id, title, children }) => (
  <section aria-labelledby={id}>
    <h2 id={id} className="text-sm font-bold text-muted px-1 mb-2">
      {title}
    </h2>
    <Card className="p-5">{children}</Card>
  </section>
);

//! Volver a ver la guía de primeros pasos del Inicio: se apaga sola al
//! terminarla, y también cuando la oculta quien la está viendo.
const GuideSection = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const { workspace, can } = useWorkspace();

  //! A quien no registra movimientos la guía no le habla, así que no se le
  //! ofrece: sería un botón que no hace nada.
  if (!workspace || !can("tx:write")) return null;

  return (
    <Section id="primeros-pasos" title="Primeros pasos">
      <p className="text-sm text-ink-2">
        La guía de primeros pasos está en el Inicio y se apaga sola cuando terminas los pasos que
        te tocan en «{workspace.name}».
      </p>
      <Button
        variant="secondary"
        className="mt-4"
        onClick={() => {
          showGuide(workspace._id, user?.id || user?._id);
          navigate("/dashboard");
        }}
      >
        <LuListChecks aria-hidden="true" /> Volver a mostrarla
      </Button>
    </Section>
  );
};

//! Mi cuenta: datos, contraseña, apariencia y salir, todo en una pantalla
const UserProfile = () => {
  const user = useSelector((state) => state.auth.user);
  const logout = useLogout();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="h-16 w-16 shrink-0 rounded-full bg-ink text-surface grid place-items-center text-xl font-extrabold"
        >
          {initials(user?.username)}
        </span>
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-ink truncate">
            {user?.username}
          </h1>
          <p className="text-sm text-muted truncate">{user?.email}</p>
        </div>
      </header>

      <Section id="tus-datos" title="Tus datos">
        <ProfileForm />
      </Section>

      <Section id="contrasena" title="Contraseña">
        <UpdatePasswordForm />
      </Section>

      <Section id="apariencia" title="Apariencia">
        <ThemeToggle />
      </Section>

      <GuideSection />

      <Button variant="danger-ghost" block onClick={logout}>
        <LuLogOut aria-hidden="true" /> Salir
      </Button>
    </div>
  );
};

export default UserProfile;
