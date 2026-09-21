import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import Dashboard from "../components/Users/Dashboard";
import { isGuideHidden } from "../lib/welcomeGuide";

//! Chart.js pinta en un canvas y aquí no hay: lo que se mira es que el Inicio
//! monte la guía de primeros pasos.
vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  ArcElement: {},
  BarElement: {},
  CategoryScale: {},
  Filler: {},
  LinearScale: {},
  LineElement: {},
  PointElement: {},
  Tooltip: {},
}));

vi.mock("react-chartjs-2", () => ({
  Bar: () => null,
  Doughnut: () => null,
  Line: () => null,
}));

const IGLESIA = {
  _id: "w-iglesia",
  name: "Iglesia Betel",
  kind: "iglesia",
  currency: "PEN",
  isDefault: true,
  role: "propietario",
  permissions: ["tx:read", "tx:write", "fund:manage", "donor:read", "members:manage"],
};

const getTransactionByPeriodAPI = vi.fn();
const getYearByMonthAPI = vi.fn();
const listTransationsAPI = vi.fn();
const getBalanceAPI = vi.fn();
const listCategoriesAPI = vi.fn();
const listFundsAPI = vi.fn();
const listDonorsAPI = vi.fn();
const listWorkspacesAPI = vi.fn();
const listMembersAPI = vi.fn();

//! `importOriginal` para no romper nada que use otra función del servicio
vi.mock("../services/transactions/transactionService", async (importOriginal) => ({
  ...(await importOriginal()),
  getTransactionByPeriodAPI: (...a) => getTransactionByPeriodAPI(...a),
  getYearByMonthAPI: (...a) => getYearByMonthAPI(...a),
  listTransationsAPI: (...a) => listTransationsAPI(...a),
  getBalanceAPI: (...a) => getBalanceAPI(...a),
}));

vi.mock("../services/category/categoryService", async (importOriginal) => ({
  ...(await importOriginal()),
  listCategoriesAPI: (...a) => listCategoriesAPI(...a),
}));

vi.mock("../services/funds/fundService", async (importOriginal) => ({
  ...(await importOriginal()),
  listFundsAPI: (...a) => listFundsAPI(...a),
}));

vi.mock("../services/donors/donorService", async (importOriginal) => ({
  ...(await importOriginal()),
  listDonorsAPI: (...a) => listDonorsAPI(...a),
}));

vi.mock("../services/workspaces/workspaceService", async (importOriginal) => ({
  ...(await importOriginal()),
  listWorkspacesAPI: (...a) => listWorkspacesAPI(...a),
  listMembersAPI: (...a) => listMembersAPI(...a),
  getWorkspaceAPI: vi.fn(),
}));

const renderInicio = () => {
  listWorkspacesAPI.mockResolvedValue([IGLESIA]);
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: {
      auth: { user: { id: "u1", username: "pastor", role: "user" }, token: "token" },
      workspace: { currentId: IGLESIA._id },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

describe("El Inicio monta la guía de primeros pasos", () => {
  beforeEach(() => {
    [
      getTransactionByPeriodAPI,
      getYearByMonthAPI,
      listTransationsAPI,
      getBalanceAPI,
      listCategoriesAPI,
      listFundsAPI,
      listDonorsAPI,
      listWorkspacesAPI,
      listMembersAPI,
    ].forEach((m) => m.mockReset());

    getTransactionByPeriodAPI.mockResolvedValue([]);
    getYearByMonthAPI.mockResolvedValue({ months: [] });
    //! Un espacio recién creado: sin movimientos, sin fondos propios, sin gente
    listTransationsAPI.mockResolvedValue({ transactions: [] });
    listCategoriesAPI.mockResolvedValue([]);
    listFundsAPI.mockResolvedValue([{ _id: null, name: "General", general: true, archived: false }]);
    listDonorsAPI.mockResolvedValue({ year: 2026, donors: [] });
    listMembersAPI.mockResolvedValue([{ userId: "u1", username: "pastor", isMe: true }]);
  });

  it("la pinta arriba, con el atajo a registrar", async () => {
    renderInicio();

    expect(await screen.findByText(/0 de 4 listos/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Registra el primer movimiento/ })).toHaveAttribute(
      "href",
      "/add-transaction"
    );
  });

  it("y no la pinta cuando el espacio ya está armado", async () => {
    listTransationsAPI.mockResolvedValue({ transactions: [{ _id: "t1", amount: 10, type: "income" }] });
    listFundsAPI.mockResolvedValue([
      { _id: null, name: "General", general: true, archived: false },
      { _id: "f1", name: "Misiones", general: false, archived: false },
    ]);
    listDonorsAPI.mockResolvedValue({ year: 2026, donors: [{ _id: "d1", name: "Ana" }] });
    listMembersAPI.mockResolvedValue([
      { userId: "u1", username: "pastor", isMe: true },
      { userId: "u2", username: "ana", isMe: false },
    ]);

    const { container } = renderInicio();

    await waitFor(() => expect(isGuideHidden(IGLESIA._id, "u1")).toBe(true));
    expect(screen.queryByText(/Primeros pasos/)).not.toBeInTheDocument();
    expect(container).not.toBeEmptyDOMElement();
  });
});
