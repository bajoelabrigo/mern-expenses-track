import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import ReportsPage from "../components/Reports/ReportsPage";

const IGLESIA = { _id: "w-iglesia", name: "Iglesia Betel", kind: "iglesia", currency: "PEN", isDefault: true };
const TESORERO = [{ ...IGLESIA, role: "tesorero", permissions: ["tx:read", "tx:write", "fund:manage"] }];

const listWorkspacesAPI = vi.fn();
vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: (...args) => listWorkspacesAPI(...args),
  getWorkspaceAPI: vi.fn(),
}));

const downloadMonthlyReportAPI = vi.fn();
const downloadAnnualReportAPI = vi.fn();
vi.mock("../services/reports/reportService", () => ({
  downloadMonthlyReportAPI: (...args) => downloadMonthlyReportAPI(...args),
  downloadAnnualReportAPI: (...args) => downloadAnnualReportAPI(...args),
}));

const NOW = new Date();
const THIS_YEAR = NOW.getFullYear();
const THIS_MONTH = NOW.getMonth() + 1;
const CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const renderPagina = () => {
  listWorkspacesAPI.mockResolvedValue(TESORERO);
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
        <MemoryRouter>
          <ReportsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

describe("Informes", () => {
  beforeEach(() => {
    downloadMonthlyReportAPI.mockReset();
    downloadAnnualReportAPI.mockReset();
  });

  it("descarga el informe del mes en curso sin tocar nada", async () => {
    downloadMonthlyReportAPI.mockResolvedValue("informe-septiembre.pdf");
    renderPagina();

    fireEvent.click(screen.getByRole("button", { name: /Descargar en PDF/ }));
    await waitFor(() => expect(downloadMonthlyReportAPI).toHaveBeenCalled());
    expect(downloadMonthlyReportAPI.mock.calls[0][0]).toEqual({ year: THIS_YEAR, month: THIS_MONTH });
    expect(await screen.findByText(/Se descargó informe-septiembre\.pdf/)).toBeInTheDocument();
  });

  it("al pasar a 'De un año' pide el anual, sin mes", async () => {
    downloadAnnualReportAPI.mockResolvedValue("informe-2026.pdf");
    renderPagina();

    fireEvent.click(screen.getByRole("radio", { name: "De un año" }));
    //! El selector de meses desaparece: un informe anual no tiene mes
    expect(screen.queryByRole("button", { name: "Ene" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Descargar en PDF/ }));
    await waitFor(() => expect(downloadAnnualReportAPI).toHaveBeenCalled());
    expect(downloadAnnualReportAPI.mock.calls[0][0]).toEqual({ year: THIS_YEAR });
    expect(downloadMonthlyReportAPI).not.toHaveBeenCalled();
  });

  it("no deja pedir un mes que todavía no ha llegado", () => {
    renderPagina();

    //! Diciembre del año en curso no existe todavía (salvo que estemos en él)
    const diciembre = screen.getByRole("button", { name: "Dic" });
    if (THIS_MONTH < 12) expect(diciembre).toBeDisabled();

    //! En un año pasado sí valen los doce
    fireEvent.click(screen.getByRole("button", { name: "Año anterior" }));
    CORTOS.forEach((mes) => expect(screen.getByRole("button", { name: mes })).toBeEnabled());
  });

  it("al volver del año pasado, un mes futuro deja de estar elegido", async () => {
    downloadMonthlyReportAPI.mockResolvedValue("informe.pdf");
    renderPagina();

    fireEvent.click(screen.getByRole("button", { name: "Año anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Dic" }));
    fireEvent.click(screen.getByRole("button", { name: "Año siguiente" }));

    fireEvent.click(screen.getByRole("button", { name: /Descargar en PDF/ }));
    await waitFor(() => expect(downloadMonthlyReportAPI).toHaveBeenCalled());
    //! Diciembre no vale en el año en curso: se cae al mes de hoy
    expect(downloadMonthlyReportAPI.mock.calls[0][0]).toEqual({ year: THIS_YEAR, month: THIS_MONTH });
  });
});
