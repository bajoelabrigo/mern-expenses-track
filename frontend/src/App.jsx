import { BrowserRouter, Route, Routes } from "react-router-dom";
import HeroSection from "./components/Home/Homepage";
import PrivateNavbar from "./components/Navbar/PrivateNavbar";
import PublicNavbar from "./components/Navbar/PublicNavbar";
import LoginForm from "./components/Users/Login";
import RegistrationForm from "./components/Users/Register";

const App = () => {
  return <BrowserRouter>
  {/*Navbar */}
  {/* <PrivateNavbar/> */}
  <PublicNavbar/>
  
  <Routes>
    <Route path="/" element={<HeroSection/>}/>
    <Route path="/login" element={<LoginForm/>}/>
    <Route path="/register" element={<RegistrationForm/>}/>
  </Routes>
  </BrowserRouter>;
};

export default App;
