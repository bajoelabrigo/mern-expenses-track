import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import AdminRoute from "../components/Auth/AdminRoute";
import AuthRoute from "../components/Auth/AuthRoute";
import AlertMessage from "../components/Alert/AlertMessage";
import AdminUsersList from "../components/Admin/AdminUsersList";

vi.mock("../services/admin/adminService", () => ({
  getAllUsersAPI: vi.fn(async () => [
    {
      _id: "1",
      username: "pastor",
      email: "pastor@iglesia.com",
      role: "admin",
      workspaces: [{ _id: "w1", name: "Iglesia Central", kind: "iglesia", role: "propietario" }],
    },
  ]),
  getAllWorkspacesAPI: vi.fn(async () => [
    {
      _id: "w1",
      name: "Iglesia Central",
      kind: "iglesia",
      currency: "PEN",
      members: 3,
      transactions: 42,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]),
}));

vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: vi.fn(async () => []),
  getWorkspaceAPI: vi.fn(),
}));

const renderConEstado = (ui, { user = null, ruta = "/" } = {}) => {
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: {
      auth: { user, token: user ? "token" : null },
      workspace: { currentId: null },
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/" element={ui} />
            <Route path="/login" element={<p>pantalla de login</p>} />
            <Route path="/dashboard" element={<p>panel de usuario</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

describe("AlertMessage", () => {
  it("muestra los errores en rojo y con rol de alerta", () => {
    render(<AlertMessage type="error" message="Credenciales inválidas" />);

    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent("Credenciales inválidas");
    expect(alerta.className).toContain("text-red-800");
  });
});

describe("rutas protegidas", () => {
  it("AuthRoute manda al login cuando no hay sesión", () => {
    renderConEstado(
      <AuthRoute>
        <p>contenido privado</p>
      </AuthRoute>
    );

    expect(screen.getByText("pantalla de login")).toBeInTheDocument();
  });

  it("AuthRoute deja pasar a un usuario autenticado", () => {
    renderConEstado(
      <AuthRoute>
        <p>contenido privado</p>
      </AuthRoute>,
      { user: { id: "1", role: "user" } }
    );

    expect(screen.getByText("contenido privado")).toBeInTheDocument();
  });

  it("AdminRoute redirige a un usuario normal al dashboard", () => {
    renderConEstado(
      <AdminRoute>
        <p>panel admin</p>
      </AdminRoute>,
      { user: { id: "1", role: "user" } }
    );

    expect(screen.getByText("panel de usuario")).toBeInTheDocument();
  });

  it("AdminRoute deja pasar a un admin", () => {
    renderConEstado(
      <AdminRoute>
        <p>panel admin</p>
      </AdminRoute>,
      { user: { id: "1", role: "admin" } }
    );

    expect(screen.getByText("panel admin")).toBeInTheDocument();
  });
});

describe("AdminUsersList", () => {
  it("lista los espacios con sus números y permite entrar como soporte", async () => {
    renderConEstado(<AdminUsersList />, {
      user: { id: "1", role: "admin" },
    });

    expect(await screen.findByText(/Iglesia Central/)).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar como soporte" })).toBeInTheDocument();
  });

  it("en la pestaña de usuarios muestra username, correo y sus espacios", async () => {
    renderConEstado(<AdminUsersList />, {
      user: { id: "1", role: "admin" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Usuarios" }));

    expect(await screen.findByText("pastor")).toBeInTheDocument();
    expect(screen.getByText("pastor@iglesia.com")).toBeInTheDocument();
    expect(screen.getByText("(Propietario)")).toBeInTheDocument();
  });
});
