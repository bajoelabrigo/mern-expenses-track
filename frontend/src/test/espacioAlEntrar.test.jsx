import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import LoginForm from "../components/Users/Login";

const loginAPI = vi.fn();
vi.mock("../services/users/userService", () => ({
  loginAPI: (...args) => loginAPI(...args),
}));

//! Entra con un usuario cuyo espacio PREDETERMINADO es "Mis finanzas" (w-mia)
const ENTRAR = () =>
  loginAPI.mockResolvedValue({
    token: "token",
    user: {
      id: "u-jorge",
      username: "jorgeaguilar",
      email: "bajoelabrigo@gmail.com",
      role: "admin",
      defaultWorkspace: "w-mia",
    },
  });

const renderLogin = (state) => {
  localStorage.clear();
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: { auth: { user: null, token: null }, workspace: { currentId: null } },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{ pathname: "/login", state }]}>
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/espacio/miembros" element={<p>pantalla de miembros</p>} />
            <Route path="/dashboard" element={<p>panel de usuario</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );

  return store;
};

const entrar = async () => {
  fireEvent.change(screen.getByLabelText("Correo"), {
    target: { value: "bajoelabrigo@gmail.com" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "Password123" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  return screen.findByText(/pantalla de miembros|panel de usuario/);
};

describe("Volver a entrar", () => {
  beforeEach(() => loginAPI.mockReset());

  it("vuelve a la pantalla que pedías, pero EN EL ESPACIO donde estabas", async () => {
    ENTRAR();
    //! Como cuando se cae la sesión dentro de la iglesia (soporte): se guarda la
    //! pantalla Y el espacio
    const store = renderLogin({ from: "/espacio/miembros", workspaceId: "w-iglesia" });

    await entrar();

    expect(await screen.findByText("pantalla de miembros")).toBeInTheDocument();
    //! El espacio recuperado es la iglesia, no el predeterminado: si no, el alta
    //! de un miembro habría ido a "Mis finanzas"
    expect(store.getState().workspace.currentId).toBe("w-iglesia");
    expect(localStorage.getItem("workspaceId")).toBe("w-iglesia");
  });

  it("sin espacio guardado abre el predeterminado, como siempre", async () => {
    ENTRAR();
    const store = renderLogin({ from: "/dashboard" });

    await entrar();

    expect(await screen.findByText("panel de usuario")).toBeInTheDocument();
    expect(store.getState().workspace.currentId).toBe("w-mia");
  });
});
