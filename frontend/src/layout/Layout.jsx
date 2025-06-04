import { Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import PrivateNavbar from "../components/Navbar/PrivateNavbar";
import PublicNavbar from "../components/Navbar/PublicNavbar";

const Layout = () => {
     const user = useSelector((state) => state.auth.user);
  return (
    <div className="min-h-screen min-w-screen">
      {/*Navbar */}
      {user ? <PrivateNavbar /> : <PublicNavbar />}
      <main className="mt-6 max-w-7xl mx-auto px-4">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
