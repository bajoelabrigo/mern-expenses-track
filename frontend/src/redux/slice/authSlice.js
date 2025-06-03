import { createSlice } from "@reduxjs/toolkit";

// Obtener el usuario del localStorage de forma segura
const getUserFromStorage = () => {
  try {
    const userInfo = localStorage.getItem("userInfo");
    return userInfo ? JSON.parse(userInfo) : null;
  } catch (error) {
    console.error("Error parsing userInfo from localStorage:", error);
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
