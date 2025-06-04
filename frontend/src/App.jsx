import { BrowserRouter, Route, Routes } from "react-router-dom";
import HeroSection from "./components/Home/Homepage";
import LoginForm from "./components/Users/Login";
import RegistrationForm from "./components/Users/Register";
import UserProfile from "./components/Users/UserProfile";
import CategoriesList from "./components/category/CategoriesList";
import UpdateCategory from "./components/category/UpdateCategory";
import TransactionForm from "./components/Transactions/TransactionForm";
import Dashboard from "./components/Users/Dashboard";
import AddCategory from "./components/category/AddCategory";
import AuthRoute from "./components/Auth/AuthRoute";
import TransactionUpdate from "./components/Transactions/TransactionUpdate";
import Layout from "./layout/Layout";
import AdminRoute from "./components/Auth/AdminRoute ";
import AdminUsersList from "./components/Admin/AdminUsersList ";
import AdminUserDashboard from "./components/Admin/AdminUserDashboard";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HeroSection />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/register" element={<RegistrationForm />} />

          <Route
            path="/add-category"
            element={
              <AuthRoute>
                <AddCategory />
              </AuthRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <AuthRoute>
                <CategoriesList />
              </AuthRoute>
            }
          />
          <Route
            path="/update-category/:id"
            element={
              <AuthRoute>
                <UpdateCategory />
              </AuthRoute>
            }
          />
          <Route
            path="/add-transaction"
            element={
              <AuthRoute>
                <TransactionForm />
              </AuthRoute>
            }
          />
          <Route
            path="/update-transactions/:id"
            element={
              <AuthRoute>
                <TransactionUpdate />
              </AuthRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <AuthRoute>
                <Dashboard />
              </AuthRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <AuthRoute>
                <UserProfile />
              </AuthRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <AdminUsersList />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/dashboard/:id"
            element={
              <AdminRoute>
                <AdminUserDashboard />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
