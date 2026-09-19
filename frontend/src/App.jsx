import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./layout/Layout";
import AuthRoute from "./components/Auth/AuthRoute";
import AdminRoute from "./components/Auth/AdminRoute";
import PermissionRoute from "./components/Auth/PermissionRoute";
import HeroSection from "./components/Home/Homepage";
import LoginForm from "./components/Users/Login";
import NotFound from "./components/common/NotFound";

//! Carga diferida: chart.js y el selector de emojis solo se descargan
//! cuando el usuario entra a esas pantallas.
const RegistrationForm = lazy(() => import("./components/Users/Register"));
const ForgotPassword = lazy(() => import("./components/Users/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/Users/ResetPassword"));
const UserProfile = lazy(() => import("./components/Users/UserProfile"));
const Dashboard = lazy(() => import("./components/Users/Dashboard"));
const CategoriesList = lazy(() =>
  import("./components/category/CategoriesList")
);
const AddCategory = lazy(() => import("./components/category/AddCategory"));
const UpdateCategory = lazy(() =>
  import("./components/category/UpdateCategory")
);
const TransactionForm = lazy(() =>
  import("./components/Transactions/TransactionForm")
);
const TransactionUpdate = lazy(() =>
  import("./components/Transactions/TransactionUpdate")
);
const WorkspacesPage = lazy(() => import("./components/Workspaces/WorkspacesPage"));
const MembersPage = lazy(() => import("./components/Workspaces/MembersPage"));
const WorkspaceSettings = lazy(() =>
  import("./components/Workspaces/WorkspaceSettings")
);
const AuditPage = lazy(() => import("./components/Workspaces/AuditPage"));
const AcceptInvitation = lazy(() =>
  import("./components/Workspaces/AcceptInvitation")
);
const MovementsPage = lazy(() => import("./components/Transactions/MovementsPage"));
const AdminUsersList = lazy(() => import("./components/Admin/AdminUsersList"));

const Cargando = () => (
  <p className="text-center text-muted py-10">Cargando...</p>
);

//! Ruta privada que además exige un permiso del rol en el espacio actual
const Privada = ({ permission, children }) => (
  <AuthRoute>
    {permission ? (
      <PermissionRoute permission={permission}>{children}</PermissionRoute>
    ) : (
      children
    )}
  </AuthRoute>
);

const App = () => (
  <BrowserRouter>
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HeroSection />} />
          <Route path="login" element={<LoginForm />} />
          <Route path="register" element={<RegistrationForm />} />
          <Route path="olvide-contrasena" element={<ForgotPassword />} />
          <Route path="restablecer-contrasena/:token" element={<ResetPassword />} />
          {/* Sin sesión muestra la invitación y manda a entrar o registrarse */}
          <Route path="invitacion/:token" element={<AcceptInvitation />} />

          <Route
            path="add-category"
            element={
              <Privada permission="category:write">
                <AddCategory />
              </Privada>
            }
          />
          <Route
            path="categories"
            element={
              <Privada>
                <CategoriesList />
              </Privada>
            }
          />
          <Route
            path="update-category/:id"
            element={
              <Privada permission="category:write">
                <UpdateCategory />
              </Privada>
            }
          />
          <Route
            path="add-transaction"
            element={
              <Privada permission="tx:write">
                <TransactionForm />
              </Privada>
            }
          />
          <Route
            path="update-transactions/:id"
            element={
              <Privada permission="tx:write">
                <TransactionUpdate />
              </Privada>
            }
          />
          <Route
            path="dashboard"
            element={
              <Privada>
                <Dashboard />
              </Privada>
            }
          />
          <Route
            path="movimientos"
            element={
              <Privada>
                <MovementsPage />
              </Privada>
            }
          />
          <Route
            path="profile"
            element={
              <Privada>
                <UserProfile />
              </Privada>
            }
          />
          <Route
            path="espacios"
            element={
              <Privada>
                <WorkspacesPage />
              </Privada>
            }
          />
          <Route
            path="espacio/miembros"
            element={
              <Privada>
                <MembersPage />
              </Privada>
            }
          />
          <Route
            path="espacio/ajustes"
            element={
              <Privada>
                <WorkspaceSettings />
              </Privada>
            }
          />
          <Route
            path="espacio/historial"
            element={
              <Privada>
                <AuditPage />
              </Privada>
            }
          />
          <Route
            path="admin/users"
            element={
              <AdminRoute>
                <AdminUsersList />
              </AdminRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default App;
