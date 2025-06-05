import { createSlice } from "@reduxjs/toolkit";

// Obtener el usuario del localStorage de forma segura
const getUserFromStorage = () => {
  try {
    const userInfo = localStorage.getItem("userInfo");
    if (!userInfo) return null;
    const parsed = JSON.parse(userInfo);

    // Verificar expiración si usas JWT con campo exp
    const token = parsed?.token; // asegúrate que `userInfo` contiene un token
    if (token) {
      const { exp } = JSON.parse(atob(token.split(".")[1]));
      if (Date.now() >= exp * 1000) {
        localStorage.removeItem("userInfo");
        return null;
      }
    }

    return parsed;
  } catch (error) {
    console.error("Error parsing userInfo:", error);
    localStorage.removeItem("userInfo");
    return null;
  }
};

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: getUserFromStorage(),
  },
  reducers: {
    loginAction: (state, action) => {
      state.user = action.payload;
      localStorage.setItem("userInfo", JSON.stringify(action.payload)); // sincroniza con localStorage
    },
    logoutAction: (state) => {
      state.user = null;
      localStorage.removeItem("userInfo"); // limpia localStorage
    },
  },
});

// Exportar acciones
export const { loginAction, logoutAction } = authSlice.actions;

// Exportar reducer
export default authSlice.reducer;
