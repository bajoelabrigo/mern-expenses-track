import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import ReportsPage from "../components/Reports/ReportsPage";

const IGLESIA = {
  _id: "w-iglesia",
  name: "Iglesia Betel",
  kind: "iglesia",
  currency: "PEN",
  isDefault: true,
};

const TESORERO = [
  {
    ...IGLESIA,
    role: "tesorero",
    permissions: ["tx:read", "donor:read", "donor:write", "audit:read"],
  },
];

const listWorkspacesAPI = vi.fn();
vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: (...a) => listWorkspacesAPI(...a),
  getWorkspaceAPI: vi.fn(),
}));

const getPaymentsReportAPI = vi.fn();
vi.mock("../services/donors/donorService", () => ({
  getPaymentsReportAPI: (...a) => getPaymentsReportAPI(...a),
  downloadStatementAPI: vi.fn(),
  downloadPaymentStatementAPI: vi.fn(),
}));

vi.mock("../services/reports/reportService", () => ({
  downloadMonthlyReportAPI: vi.fn(),
  downloadAnnualReportAPI: vi.fn(),
}));

const renderCon = () => {
  listWorkspacesAPI.mockResolvedValue(TESORERO);
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: {
      auth: { user: { id: "u-1", role: "user" }, token: "token" },
      workspace: { currentId: IGLESIA._id },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<ReportsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

const INFORME = {
  year: 2026,
  total: 2390,
  payments: 9,
  people: [
    { _id: "p1", name: "Ana Torres", member: true, amount: 680, concepts: 2 },
    { _id: "p2", name: "Pedro el gasfitero", member: false, amount: 510, concepts: 1 },
  ],
  byKind: [{ kind: "jornal", label: "Jornal", amount: 1290 }],
  expenseTotal: 4495,
  share: 53.2,
};

describe("Informes: pagos a personas", () => {
  beforeEach(() => getPaymentsReportAPI.mockReset());

  it("resume el año sin repetir el punto de la frase", async () => {
    getPaymentsReportAPI.mockResolvedValue(INFORME);
    renderCon();

    const frase = await screen.findByText(/de todo el gasto del año/);
    expect(frase.textContent).toMatch(/53\.2% de todo el gasto del año\.$/);
    expect(frase.textContent).not.toMatch(/año\.\./);
    //! Y el desglose que hace útil la tarjeta
    expect(screen.getByText("Jornal")).toBeInTheDocument();
    expect(screen.getByText("Ana Torres")).toBeInTheDocument();
  });

  it("sin gasto con el que comparar cierra la frase igual de bien", async () => {
    getPaymentsReportAPI.mockResolvedValue({
      ...INFORME,
      payments: 1,
      people: [INFORME.people[0]],
      expenseTotal: 0,
      share: 0,
    });
    renderCon();

    const frase = await screen.findByText(/^En 1 pago a 1 persona/);
    expect(frase.textContent).toMatch(/persona\.$/);
    expect(frase.textContent).not.toMatch(/\.\./);
  });
});
