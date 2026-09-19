import { useSelector } from "react-redux";
import { LuLogOut } from "react-icons/lu";
import { useLogout } from "../../hooks/useLogout";
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

      <Button variant="danger-ghost" block onClick={logout}>
        <LuLogOut aria-hidden="true" /> Salir
      </Button>
    </div>
  );
};

export default UserProfile;
