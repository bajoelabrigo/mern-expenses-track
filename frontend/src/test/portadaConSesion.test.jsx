import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import GuestRoute from "../components/Auth/GuestRoute";

//! Con sesión abierta, la portada y el registro no pintan nada: la portada
//! invita a crear una cuenta que ya existe, y encima se veía con la barra
//! lateral de la app alrededor, porque esa sí mira la sesión.
const renderEn = (ruta, user) => {
  localStorage.clear();
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: {
      auth: { user, token: user ? "token" : null },
      workspace: { currentId: user ? "w1" : null },
    },
  });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route
            path="/"
            element={
              <GuestRoute>
                <p>portada</p>
              </GuestRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute>
                <p>crear cuenta</p>
              </GuestRoute>
            }
          />
          <Route path="/dashboard" element={<p>panel</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
};

describe("La portada con sesión abierta", () => {
  it("manda al panel en vez de enseñar la portada", () => {
    renderEn("/", { id: "u1", role: "user" });

    expect(screen.getByText("panel")).toBeInTheDocument();
    expect(screen.queryByText("portada")).not.toBeInTheDocument();
  });

  it("también manda al panel desde crear cuenta", () => {
    renderEn("/register", { id: "u1", role: "user" });

    expect(screen.getByText("panel")).toBeInTheDocument();
    expect(screen.queryByText("crear cuenta")).not.toBeInTheDocument();
  });

  it("sin sesión la portada se ve, que para eso está", () => {
    renderEn("/", null);

    expect(screen.getByText("portada")).toBeInTheDocument();
    expect(screen.queryByText("panel")).not.toBeInTheDocument();
  });

  it("sin sesión también se puede crear una cuenta", () => {
    renderEn("/register", null);

    expect(screen.getByText("crear cuenta")).toBeInTheDocument();
  });
});
