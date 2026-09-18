import { createSlice } from "@reduxjs/toolkit";
import {
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
} from "../../utils/storage";

const stored = getStoredAuth();

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: stored?.user || null,
    token: stored?.token || null,
  },
  reducers: {
    //! payload: { token, user }
    loginAction: (state, action) => {
      const { token, user } = action.payload || {};
      state.user = user || null;
      state.token = token || null;
      if (token && user) {
        setStoredAuth({ token, user });
      }
    },
    //! Actualiza los datos del perfil sin tocar el token
    updateUserAction: (state, action) => {
      state.user = action.payload;
      if (state.token && action.payload) {
        setStoredAuth({ token: state.token, user: action.payload });
      }
    },
    logoutAction: (state) => {
      state.user = null;
      state.token = null;
      clearStoredAuth();
    },
  },
});

export const { loginAction, logoutAction, updateUserAction } = authSlice.actions;

export default authSlice.reducer;
