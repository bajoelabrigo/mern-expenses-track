import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer, { loginAction, logoutAction } from "../redux/slice/authSlice";
import workspaceReducer, { setWorkspaceAction } from "../redux/slice/workspaceSlice";
import PermissionRoute from "../components/Auth/PermissionRoute";
import MovementsPage from "../components/Transactions/MovementsPage";
import TransactionUpdate from "../components/Transactions/TransactionUpdate";
import { useWorkspace } from "../hooks/useWorkspace";

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
const getWorkspaceAPI = vi.fn();
vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: (...args) => listWorkspacesAPI(...args),
  getWorkspaceAPI: (...args) => getWorkspaceAPI(...args),
}));

vi.mock("../services/category/categoryService", () => ({
  listCategoriesAPI: vi.fn(async () => []),
}));

vi.mock("../services/funds/fundService", () => ({
  listFundsAPI: vi.fn(async () => [{ _id: null, name: "General", icon: "🏛️", general: true, balance: 0 }]),
}));

const TX_ACTIVO = {
  _id: "t1",
  type: "income",
  category: "diezmos",
  amount: 150.5,
  date: "2026-09-01T12:00:00.000Z",
  voided: false,
  receipt: null,
  createdBy: { username: "tesorera" },
};
const TX_ANULADO = {
  ...TX_ACTIVO,
  _id: "t2",
  type: "expense",
  category: "luz",
  amount: 40,
  voided: true,
  voidReason: "Duplicado",
};
const fetchTransactionByIdAPI = vi.fn();

vi.mock("../services/transactions/transactionService", () => ({
  listTransationsAPI: vi.fn(async () => ({
    total: 1,
    currentPage: 1,
    totalPages: 1,
    transactions: [TX_ACTIVO],
  })),
  fetchTransactionByIdAPI: (...args) => fetchTransactionByIdAPI(...args),
  exportTransactionExcelAPI: vi.fn(),
  addTransactionAPI: vi.fn(),
  updateTransactionAPI: vi.fn(),
  attachReceiptAPI: vi.fn(),
  removeReceiptAPI: vi.fn(),
  getReceiptUrlAPI: vi.fn(),
  voidTransactionAPI: vi.fn(),
  restoreTransactionAPI: vi.fn(),
  purgeTransactionAPI: vi.fn(),
}));

const renderConEspacio = (ui, ruta = "/") => {
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
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/" element={ui} />
            <Route path="/tx/:id" element={ui} />
            <Route path="/espacio/miembros" element={ui} />
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

describe("Movimientos y acciones según el rol", () => {
  beforeEach(() => {
    listWorkspacesAPI.mockReset();
    fetchTransactionByIdAPI.mockReset();
  });

  it("la lista muestra el importe con la moneda del espacio y quién lo registró", async () => {
    listWorkspacesAPI.mockResolvedValue(LECTOR);
    renderConEspacio(<MovementsPage />);

    //! Lo que entra lleva "+" delante
    //! Aparece en la fila y en el total del día (ese día solo tiene este)
    expect(await screen.findAllByText(/^\+S\/\s150\.50$/)).toHaveLength(2);
    expect(screen.getByText(/por tesorera/)).toBeInTheDocument();
  });

  it("un lector ve el movimiento pero no puede anularlo ni borrarlo", async () => {
    listWorkspacesAPI.mockResolvedValue(LECTOR);
    fetchTransactionByIdAPI.mockResolvedValue(TX_ACTIVO);
    renderConEspacio(<TransactionUpdate />, "/tx/t1");

    expect(await screen.findByText("Comprobante")).toBeInTheDocument();
    expect(screen.queryByText("Anular movimiento")).not.toBeInTheDocument();
    expect(screen.queryByText("Borrar definitivamente")).not.toBeInTheDocument();
  });

  it("un contador puede anular, pero no borrar definitivamente", async () => {
    listWorkspacesAPI.mockResolvedValue(CONTADOR);
    fetchTransactionByIdAPI.mockResolvedValue(TX_ACTIVO);
    renderConEspacio(<TransactionUpdate />, "/tx/t1");

    expect(await screen.findByText("Anular movimiento")).toBeInTheDocument();
    expect(screen.queryByText("Borrar definitivamente")).not.toBeInTheDocument();
  });

  it("el propietario ve el anulado con su motivo, puede restaurarlo y borrarlo", async () => {
    listWorkspacesAPI.mockResolvedValue(PROPIETARIO);
    fetchTransactionByIdAPI.mockResolvedValue(TX_ANULADO);
    renderConEspacio(<TransactionUpdate />, "/tx/t2");

    expect(await screen.findByText(/anulado: Duplicado/)).toBeInTheDocument();
    //! Las acciones aparecen cuando se conoce el rol
    expect(await screen.findByText("Restaurar movimiento")).toBeInTheDocument();
    expect(screen.getByText("Borrar definitivamente")).toBeInTheDocument();
    //! Un anulado no se edita: el botón de guardar lo explica
    expect(screen.getByRole("button", { name: /restáuralo para editarlo/ })).toBeDisabled();
  });
});

//! Espacio que se está usando, tal como lo ve cualquier pantalla
const EspacioActual = () => {
  const { workspace, isSupport } = useWorkspace();
  return (
    <>
      <p>{workspace ? `${workspace.name}:${workspace.role}` : "cargando espacio"}</p>
      {isSupport && <p>en soporte</p>}
    </>
  );
};

//! El usuario solo tiene "Mis finanzas"; el espacio pedido (w-iglesia) es de otra
//! persona: la API decide si puede entrar (soporte) o no.
const MIS_FINANZAS = [
  {
    _id: "w-mia",
    name: "Mis finanzas",
    kind: "personal",
    currency: "PEN",
    isDefault: true,
    role: "propietario",
    permissions: ["tx:read"],
  },
];
const IGLESIA_AJENA = {
  _id: "w-iglesia",
  name: "Iglesia Betel",
  kind: "iglesia",
  currency: "PEN",
  role: "propietario",
  permissions: ["tx:read", "members:manage"],
};

describe("El espacio que se pidió, cuando no está en tu lista", () => {
  beforeEach(() => {
    listWorkspacesAPI.mockReset();
    getWorkspaceAPI.mockReset();
    localStorage.clear();
  });

  it("si la API da acceso se usa ese espacio, aunque el cliente no te marque admin", async () => {
    //! El usuario de la prueba NO tiene role "admin": antes, por eso mismo, la
    //! app abría su espacio personal y lo que se hiciera iba al libro equivocado
    listWorkspacesAPI.mockResolvedValue(MIS_FINANZAS);
    getWorkspaceAPI.mockResolvedValue(IGLESIA_AJENA);

    renderConEspacio(<EspacioActual />, "/espacio/miembros");

    expect(await screen.findByText("Iglesia Betel:propietario")).toBeInTheDocument();
    expect(screen.getByText("en soporte")).toBeInTheDocument();
  });

  it("si la API no da acceso, abre el predeterminado y se va al Inicio", async () => {
    listWorkspacesAPI.mockResolvedValue(MIS_FINANZAS);
    getWorkspaceAPI.mockRejectedValue(
      Object.assign(new Error("403"), {
        response: { status: 403, data: { code: "NOT_A_MEMBER" } },
      })
    );

    renderConEspacio(<EspacioActual />, "/espacio/miembros");

    //! No se queda en la pantalla del espacio ajeno: se abre el propio Inicio
    expect(await screen.findByText("panel de usuario")).toBeInTheDocument();
    expect(localStorage.getItem("workspaceId")).toBe("w-mia");
  });
});
