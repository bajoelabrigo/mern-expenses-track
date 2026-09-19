import { Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import PrivateNavbar from "../components/Navbar/PrivateNavbar";
import PublicNavbar from "../components/Navbar/PublicNavbar";
import OfflineBanner from "../components/common/OfflineBanner";
import UpdatePrompt from "../components/common/UpdatePrompt";

const Layout = () => {
  const user = useSelector((state) => state.auth.user);
  return (
    <div className="min-h-screen min-w-screen">
      <OfflineBanner />
      {user ? <PrivateNavbar /> : <PublicNavbar />}
      <main className="mt-6 max-w-7xl mx-auto px-4 pb-10">
        <Outlet />
      </main>
      <UpdatePrompt />
    </div>
  );
};

export default Layout;
