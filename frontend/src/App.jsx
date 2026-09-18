import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./layout/Layout";
import AuthRoute from "./components/Auth/AuthRoute";
import AdminRoute from "./components/Auth/AdminRoute";
import HeroSection from "./components/Home/Homepage";
import LoginForm from "./components/Users/Login";
import NotFound from "./components/common/NotFound";

//! Carga diferida: chart.js y el selector de emojis solo se descargan
//! cuando el usuario entra a esas pantallas.
const RegistrationForm = lazy(() => import("./components/Users/Register"));
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
const AdminUsersList = lazy(() => import("./components/Admin/AdminUsersList"));
const AdminUserDashboard = lazy(() =>
  import("./components/Admin/AdminUserDashboard")
);

const Cargando = () => (
  <p className="text-center text-gray-500 py-10">Cargando...</p>
);

const App = () => (
  <BrowserRouter>
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HeroSection />} />
          <Route path="login" element={<LoginForm />} />
          <Route path="register" element={<RegistrationForm />} />

          <Route
            path="add-category"
            element={
              <AuthRoute>
                <AddCategory />
              </AuthRoute>
            }
          />
          <Route
            path="categories"
            element={
              <AuthRoute>
                <CategoriesList />
              </AuthRoute>
            }
          />
          <Route
            path="update-category/:id"
            element={
              <AuthRoute>
                <UpdateCategory />
              </AuthRoute>
            }
          />
          <Route
            path="add-transaction"
            element={
              <AuthRoute>
                <TransactionForm />
              </AuthRoute>
            }
          />
          <Route
            path="update-transactions/:id"
            element={
              <AuthRoute>
                <TransactionUpdate />
              </AuthRoute>
            }
          />
          <Route
            path="dashboard"
            element={
              <AuthRoute>
                <Dashboard />
              </AuthRoute>
            }
          />
          <Route
            path="profile"
            element={
              <AuthRoute>
                <UserProfile />
              </AuthRoute>
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
          <Route
            path="admin/dashboard/:id"
            element={
              <AdminRoute>
                <AdminUserDashboard />
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
