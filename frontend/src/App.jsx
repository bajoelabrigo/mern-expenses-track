import { BrowserRouter, Route, Routes } from "react-router-dom";
import HeroSection from "./components/Home/Homepage";
import PrivateNavbar from "./components/Navbar/PrivateNavbar";
import PublicNavbar from "./components/Navbar/PublicNavbar";
import LoginForm from "./components/Users/Login";
import RegistrationForm from "./components/Users/Register";
import UserProfile from "./components/Users/UserProfile";
import CategoriesList from "./components/category/CategoriesList";
import UpdateCategory from "./components/category/UpdateCategory";
import TransactionForm from "./components/Transactions/TransactionForm";
import Dashboard from "./components/Users/Dashboard";
import { useSelector } from "react-redux";
import AddCategory from "./components/category/AddCategory";
import AuthRoute from "./components/Auth/AuthRoute";

const App = () => {
  const user = useSelector((state) => state.auth.user);
  return (
    <BrowserRouter>
      {/*Navbar */}
      {user ? <PrivateNavbar /> : <PublicNavbar />}

      <Routes>
        <Route path="/" element={<HeroSection />} />
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
      </Routes>
    </BrowserRouter>
  );
};

export default App;
