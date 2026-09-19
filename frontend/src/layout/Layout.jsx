import { Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import PublicNavbar from "../components/Navbar/PublicNavbar";
import OfflineBanner from "../components/common/OfflineBanner";
import UpdatePrompt from "../components/common/UpdatePrompt";
import { BottomNav, Sidebar } from "../components/layout/AppNav";
import { useOutboxSync } from "../hooks/useOutbox";

//! Envía en segundo plano lo registrado sin conexión (solo con sesión)
const OutboxSync = () => {
  useOutboxSync();
  return null;
};

const Layout = () => {
  const user = useSelector((state) => state.auth.user);

  if (!user) {
    return (
      <div className="min-h-screen bg-bg">
        <OfflineBanner />
        <PublicNavbar />
        <main>
          <Outlet />
        </main>
        <UpdatePrompt />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <OutboxSync />
      <Sidebar />
      <div className="lg:pl-64">
        <OfflineBanner />
        {/* pb para no quedar debajo de la barra inferior en el móvil */}
        <main className="max-w-3xl mx-auto px-4 pt-5 pb-28 lg:pb-12 lg:pt-8">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <UpdatePrompt />
    </div>
  );
};

export default Layout;
