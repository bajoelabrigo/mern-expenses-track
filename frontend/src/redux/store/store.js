import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../slice/authSlice";
import workspaceReducer from "../slice/workspaceSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    workspace: workspaceReducer,
  },
});
