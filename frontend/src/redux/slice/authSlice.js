import { createSlice } from "@reduxjs/toolkit";

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
  },
  reducers: {
    loginAction: (state, action) => {
      state.user = action.payload;
    },
    logoutAction: (state, action) => {
      state.user = null;
    },
  },
});

//!Generate actions
export const { loginAction, logoutAction } = authSlice.actions;

//! Generate the reducers
const authReducer = authSlice.reducer;
export default authReducer;
