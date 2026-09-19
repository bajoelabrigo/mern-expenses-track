import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer, { loginAction, logoutAction } from "../redux/slice/authSlice";
import workspaceReducer, { setWorkspaceAction } from "../redux/slice/workspaceSlice";
import PermissionRoute from "../components/Auth/PermissionRoute";
import TransactionList from "../components/Transactions/TransactionList";

const IGLESIA = {
  _id: "w-iglesia",
  name: "Iglesia Betel",
  kind: "iglesia",
  currency: "PEN",
  isDefault: true,
};

const conRol = (role, permissions) => [{ ...IGLESIA, role, permissions }];

const LECTOR = conRol("lector", ["tx:read"]);
const CONTADOR = conRol("contador", ["tx:read", "tx:write", "category:write"]);
const PROPIETARIO = conRol("propietario", [
  "tx:read",
  "tx:write",
  "tx:purge",
  "category:write",
  "members:manage",
  "audit:read",
  "workspace:manage",
  "workspace:delete",
]);

const listWorkspacesAPI = vi.fn();
vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: (...args) => listWorkspacesAPI(...args),
  getWorkspaceAPI: vi.fn(),
}));

vi.mock("../services/category/categoryService", () => ({
  listCategoriesAPI: vi.fn(async () => []),
}));

vi.mock("../services/transactions/transactionService", () => ({
  listTransationsAPI: vi.fn(async ({ includeVoided }) => ({
    total: includeVoided ? 2 : 1,
    currentPage: 1,
    totalPages: 1,
    transactions: [
      {
        _id: "t1",
        type: "income",
        category: "diezmos",
        amount: 150.5,
        date: "2026-09-01T12:00:00.000Z",
        voided: false,
        createdBy: { username: "tesorera" },
      },
      ...(includeVoided
        ? [
            {
              _id: "t2",
              type: "expense",
              category: "luz",
              amount: 40,
              date: "2026-09-02T12:00:00.000Z",
              voided: true,
              voidReason: "Duplicado",
            },
          ]
        : []),
    ],
  })),
  voidTransactionAPI: vi.fn(),
  restoreTransactionAPI: vi.fn(),
  purgeTransactionAPI: vi.fn(),
}));

const renderConEspacio = (ui) => {
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: {
      auth: { user: { id: "1", role: "user" }, token: "token" },
      workspace: { currentId: IGLESIA._id },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={ui} />
            <Route path="/dashboard" element={<p>panel de usuario</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

describe("workspaceSlice", () => {
  it("al iniciar sesión abre el espacio predeterminado y lo recuerda", () => {
    const estado = workspaceReducer(
      { currentId: "viejo" },
      loginAction({ token: "t", user: { id: "1", defaultWorkspace: "w-default" } })
    );
    expect(estado.currentId).toBe("w-default");
    expect(localStorage.getItem("workspaceId")).toBe("w-default");
  });

  it("al cerrar sesión olvida el espacio (otro puede usar el dispositivo)", () => {
    localStorage.setItem("workspaceId", "w1");
    const estado = workspaceReducer({ currentId: "w1" }, logoutAction());
    expect(estado.currentId).toBeNull();
    expect(localStorage.getItem("workspaceId")).toBeNull();
  });

  it("cambiar de espacio lo guarda", () => {
    const estado = workspaceReducer({ currentId: null }, setWorkspaceAction("w2"));
    expect(estado.currentId).toBe("w2");
    expect(localStorage.getItem("workspaceId")).toBe("w2");
  });
});

describe("PermissionRoute", () => {
  beforeEach(() => listWorkspacesAPI.mockReset());

  it("un lector no entra al formulario de alta", async () => {
    listWorkspacesAPI.mockResolvedValue(LECTOR);
    renderConEspacio(
      <PermissionRoute permission="tx:write">
        <p>formulario de alta</p>
      </PermissionRoute>
    );

    expect(await screen.findByText("panel de usuario")).toBeInTheDocument();
    expect(screen.queryByText("formulario de alta")).not.toBeInTheDocument();
  });

  it("un contador sí entra", async () => {
    listWorkspacesAPI.mockResolvedValue(CONTADOR);
    renderConEspacio(
      <PermissionRoute permission="tx:write">
        <p>formulario de alta</p>
      </PermissionRoute>
    );

    expect(await screen.findByText("formulario de alta")).toBeInTheDocument();
  });
});

describe("TransactionList según el rol", () => {
  beforeEach(() => listWorkspacesAPI.mockReset());

  it("un lector ve los movimientos con la moneda del espacio, sin botones de edición", async () => {
    listWorkspacesAPI.mockResolvedValue(LECTOR);
    renderConEspacio(<TransactionList />);

    expect(await screen.findByText("S/ 150.50")).toBeInTheDocument();
    expect(screen.getByText("por tesorera")).toBeInTheDocument();
    expect(screen.queryByLabelText("Editar transacción")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Anular movimiento")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Borrar definitivamente")).not.toBeInTheDocument();
  });

  it("un contador puede editar y anular, pero no borrar definitivamente", async () => {
    listWorkspacesAPI.mockResolvedValue(CONTADOR);
    renderConEspacio(<TransactionList />);

    expect(await screen.findByLabelText("Editar transacción")).toBeInTheDocument();
    expect(screen.getByLabelText("Anular movimiento")).toBeInTheDocument();
    expect(screen.queryByLabelText("Borrar definitivamente")).not.toBeInTheDocument();
  });

  it("el propietario ve los anulados tachados, con su motivo y para restaurar", async () => {
    listWorkspacesAPI.mockResolvedValue(PROPIETARIO);
    renderConEspacio(<TransactionList />);

    const toggle = await screen.findByLabelText("Mostrar anulados");
    await waitFor(() => expect(screen.getByLabelText("Anular movimiento")).toBeInTheDocument());
    toggle.click();

    expect(await screen.findByText("Anulado: Duplicado")).toBeInTheDocument();
    expect(screen.getByLabelText("Restaurar movimiento")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Borrar definitivamente")).toHaveLength(2);
  });
});
