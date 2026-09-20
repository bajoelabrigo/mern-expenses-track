import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import FundsPage from "../components/Funds/FundsPage";
import TransferPage from "../components/Funds/TransferPage";
import TransactionForm from "../components/Transactions/TransactionForm";
import FundDetail from "../components/Funds/FundDetail";

const IGLESIA = { _id: "w-iglesia", name: "Iglesia Betel", kind: "iglesia", currency: "PEN", isDefault: true };
const TESORERO = [
  { ...IGLESIA, role: "tesorero", permissions: ["tx:read", "tx:write", "category:write", "fund:manage"] },
];
const LECTOR = [{ ...IGLESIA, role: "lector", permissions: ["tx:read"] }];
//! El tesorero de verdad también puede ver quién dio
const TESORERO_CON_APORTANTES = [{ ...TESORERO[0], permissions: [...TESORERO[0].permissions, "donor:read"] }];

const listWorkspacesAPI = vi.fn();
vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: (...args) => listWorkspacesAPI(...args),
  getWorkspaceAPI: vi.fn(),
}));

vi.mock("../services/category/categoryService", () => ({
  listCategoriesAPI: vi.fn(async () => [{ _id: "c1", name: "ofrendas", type: "income", icon: "💝" }]),
}));

const addTransactionAPI = vi.fn();
vi.mock("../services/transactions/transactionService", () => ({
  addTransactionAPI: (...args) => addTransactionAPI(...args),
  updateTransactionAPI: vi.fn(),
  attachReceiptAPI: vi.fn(),
  listTransationsAPI: vi.fn(async () => ({ transactions: [], total: 0 })),
}));

const FONDOS = [
  { _id: null, name: "General", icon: "🏛️", general: true, archived: false, balance: 1200, raised: 1500, goal: null },
  {
    _id: "f-misiones",
    name: "Misiones",
    icon: "🌍",
    general: false,
    archived: false,
    balance: 300,
    raised: 300,
    goal: 1000,
    description: "Para los misioneros",
  },
  { _id: "f-viejo", name: "Viejo", icon: "🏦", general: false, archived: true, balance: 0, raised: 0, goal: null },
];
const createTransferAPI = vi.fn();
const downloadFundReportAPI = vi.fn();
vi.mock("../services/funds/fundService", () => ({
  listFundsAPI: vi.fn(async () => FONDOS),
  createTransferAPI: (...args) => createTransferAPI(...args),
  downloadFundReportAPI: (...args) => downloadFundReportAPI(...args),
  listTransfersAPI: vi.fn(async () => []),
  updateFundAPI: vi.fn(),
  deleteFundAPI: vi.fn(),
  voidTransferAPI: vi.fn(),
}));

const renderCon = (ui, { ruta = "/", workspaces = TESORERO } = {}) => {
  listWorkspacesAPI.mockResolvedValue(workspaces);
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
            <Route path="/fondos/mover" element={ui} />
            <Route path="/fondos/:id" element={<p>detalle del fondo</p>} />
            <Route path="/detalle/:id" element={ui} />
            <Route path="/dashboard" element={<p>panel</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

describe("Fondos", () => {
  beforeEach(() => {
    addTransactionAPI.mockReset();
    createTransferAPI.mockReset();
    downloadFundReportAPI.mockReset();
  });

  it("muestra el total en caja, el avance de la meta y aparta los archivados", async () => {
    renderCon(<FundsPage />);

    expect(await screen.findByText("S/ 1,500.00 en caja, repartidos así.")).toBeInTheDocument();
    expect(screen.getByText("Misiones")).toBeInTheDocument();
    expect(screen.getByText("S/ 300.00 de S/ 1,000.00")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("Archivados · 1")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Nuevo/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mover dinero/ })).toBeInTheDocument();
  });

  it("un lector ve los fondos pero no puede crearlos ni mover dinero", async () => {
    renderCon(<FundsPage />, { workspaces: LECTOR });

    expect(await screen.findByText("Misiones")).toBeInTheDocument();
    await waitFor(() => expect(listWorkspacesAPI).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /Nuevo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Mover dinero/ })).not.toBeInTheDocument();
  });

  it("al registrar se elige el fondo; los archivados no se ofrecen", async () => {
    addTransactionAPI.mockResolvedValue([{ _id: "t-nuevo" }]);
    renderCon(<TransactionForm />);

    fireEvent.click(screen.getByRole("radio", { name: "Ingreso" }));
    fireEvent.click(await screen.findByRole("button", { name: /Ofrendas/ }));
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: "0" }));

    const fondo = await screen.findByRole("combobox", { name: "Fondo" });
    expect(screen.queryByRole("option", { name: /Viejo/ })).not.toBeInTheDocument();
    fireEvent.change(fondo, { target: { value: "f-misiones" } });
    fireEvent.click(screen.getByRole("button", { name: /Registrar ingreso/ }));

    await waitFor(() => expect(addTransactionAPI).toHaveBeenCalled());
    expect(addTransactionAPI.mock.calls[0][0]).toMatchObject({ fund: "f-misiones", amount: 50, type: "income" });
  });

  it("mover dinero avisa si el fondo de origen queda en negativo y manda el General como null", async () => {
    createTransferAPI.mockResolvedValue({ _id: "p1" });
    renderCon(<TransferPage />, { ruta: "/fondos/mover?desde=f-misiones&hacia=general" });

    const monto = await screen.findByLabelText("Monto");
    fireEvent.change(monto, { target: { value: "450" } });
    expect(screen.getByText(/quedará en negativo/)).toBeInTheDocument();

    fireEvent.change(monto, { target: { value: "250,50" } });
    expect(screen.queryByText(/quedará en negativo/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mover S\/\s250\.50/ }));

    await waitFor(() => expect(createTransferAPI).toHaveBeenCalled());
    expect(createTransferAPI.mock.calls[0][0]).toMatchObject({ from: "f-misiones", to: null, amount: 250.5 });
    expect(await screen.findByText("detalle del fondo")).toBeInTheDocument();
  });
  it("el informe de la actividad se descarga, con o sin los nombres", async () => {
    downloadFundReportAPI.mockResolvedValue("informe-misiones-2026.pdf");
    renderCon(<FundDetail />, { ruta: "/detalle/f-misiones", workspaces: TESORERO_CON_APORTANTES });

    //! El panel está guardado hasta que se pide
    expect(await screen.findByRole("heading", { name: "Misiones" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Descargar/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Informe en PDF/ }));
    const casilla = screen.getByLabelText(/Incluir los nombres/);
    expect(casilla).not.toBeChecked();

    //! Sin marcar la casilla, el informe va sin nombres
    fireEvent.click(screen.getByRole("button", { name: /Descargar/ }));
    await waitFor(() => expect(downloadFundReportAPI).toHaveBeenCalled());
    expect(downloadFundReportAPI.mock.calls[0][0]).toEqual({ fund: "f-misiones", withNames: false });
    expect(await screen.findByText(/Se descargó informe-misiones-2026\.pdf/)).toBeInTheDocument();

    //! Al marcarla, avisa de que ya no se puede publicar
    fireEvent.click(casilla);
    expect(screen.getByText(/ya no se puede publicar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Descargar/ }));
    await waitFor(() => expect(downloadFundReportAPI).toHaveBeenCalledTimes(2));
    expect(downloadFundReportAPI.mock.calls[1][0]).toEqual({ fund: "f-misiones", withNames: true });
  });

  it("quien no puede ver aportantes no ve la casilla de los nombres", async () => {
    renderCon(<FundDetail />, { ruta: "/detalle/f-misiones", workspaces: LECTOR });

    expect(await screen.findByRole("heading", { name: "Misiones" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Informe en PDF/ }));
    expect(screen.queryByLabelText(/Incluir los nombres/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Descargar/ })).toBeInTheDocument();
  });
});