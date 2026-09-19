import { createSlice } from "@reduxjs/toolkit";
import {
  clearStoredWorkspaceId,
  getStoredWorkspaceId,
  setStoredWorkspaceId,
} from "../../utils/storage";
import { loginAction, logoutAction } from "./authSlice";

//! Espacio en el que se trabaja. Solo el id: los datos (nombre, rol, permisos)
//! vienen de la API con useWorkspace. null = el predeterminado del usuario.
const workspaceSlice = createSlice({
  name: "workspace",
  initialState: { currentId: getStoredWorkspaceId() },
  reducers: {
    setWorkspaceAction: (state, action) => {
      state.currentId = action.payload || null;
      if (action.payload) setStoredWorkspaceId(action.payload);
      else clearStoredWorkspaceId();
    },
  },
  extraReducers: (builder) => {
    //! Al entrar se abre el predeterminado del usuario; al salir no se
    //! recuerda nada (otra persona puede usar el mismo dispositivo).
    builder.addCase(loginAction, (state, action) => {
      const id = action.payload?.user?.defaultWorkspace || null;
      state.currentId = id;
      if (id) setStoredWorkspaceId(id);
      else clearStoredWorkspaceId();
    });
    builder.addCase(logoutAction, (state) => {
      state.currentId = null;
      clearStoredWorkspaceId();
    });
  },
});

export const { setWorkspaceAction } = workspaceSlice.actions;

export default workspaceSlice.reducer;
