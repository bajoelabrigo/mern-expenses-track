import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import CountsPage from "../components/Counts/CountsPage";
import { sumBreakdown, denominationsFor } from "../lib/denominations";

const IGLESIA = { _id: "w1", name: "Iglesia Betel", kind: "iglesia", currency: "PEN", isDefault: true };
const PERSONAL = { _id: "w2", name: "Mis finanzas", kind: "personal", currency: "PEN" };
const TESORERO = [{ ...IGLESIA, role: "tesorero", permissions: ["tx:read", "tx:write"] }];
const AUDITOR = [{ ...IGLESIA, role: "auditor", permissions: ["tx:read"] }];
const EN_PERSONAL = [{ ...PERSONAL, role: "propietario", permissions: ["tx:read", "tx:write"] }];

const listWorkspacesAPI = vi.fn();
vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: (...args) => listWorkspacesAPI(...args),
  getWorkspaceAPI: vi.fn(),
}));

vi.mock("../services/funds/fundService", () => ({
  listFundsAPI: vi.fn(async () => [
    { _id: null, name: "General", general: true, archived: false, balance: 0 },
  ]),
}));

const listCountsAPI = vi.fn();
const createCountAPI = vi.fn();
const confirmCountAPI = vi.fn();
const voidCountAPI = vi.fn();
vi.mock("../services/counts/countService", () => ({
  listCountsAPI: (...args) => listCountsAPI(...args),
  createCountAPI: (...args) => createCountAPI(...args),
  confirmCountAPI: (...args) => confirmCountAPI(...args),
  voidCountAPI: (...args) => voidCountAPI(...args),
}));

const YO = "u-yo";
const OTRO = "u-otro";

const conteo = (extra = {}) => ({
  _id: "c1",
  date: "2026-09-13",
  service: "Culto del domingo",
  amount: 505,
  breakdown: [{ value: 50, count: 4 }],
  status: "pendiente",
  countedBy: { _id: OTRO, username: "pastor_juan" },
  confirmedBy: null,
  fund: null,
  note: "",
  ...extra,
});

const renderCon = ({ workspaces = TESORERO, currentId = "w1" } = {}) => {
  listWorkspacesAPI.mockResolvedValue(workspaces);
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: {
      auth: { user: { id: YO, role: "user" }, token: "token" },
      workspace: { currentId },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/conteos"]}>
          <Routes>
            <Route path="/conteos" element={<CountsPage />} />
            <Route path="/dashboard" element={<p>panel</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

describe("Conteo de ofrenda", () => {
  beforeEach(() => {
    listCountsAPI.mockReset();
    createCountAPI.mockReset();
    confirmCountAPI.mockReset();
    voidCountAPI.mockReset();
    listCountsAPI.mockResolvedValue({ me: YO, counts: [] });
  });

  it("suma el desglose sin que se escapen los decimales", () => {
    //! 0.1 × 3 en coma flotante da 0.30000000000000004
    expect(sumBreakdown([{ value: 0.1, count: 3 }])).toBe(0.3);
    expect(
      sumBreakdown([
        { value: 50, count: 4 },
        { value: 20, count: 7 },
        { value: 10, count: 12 },
        { value: 5, count: 9 },
      ])
    ).toBe(505);
    //! Las filas vacías no estorban
    expect(sumBreakdown([{ value: 200, count: "" }])).toBe(0);
  });

  it("conoce los billetes de cada moneda y no se inventa los que no sabe", () => {
    expect(denominationsFor("PEN")[0]).toBe(200);
    expect(denominationsFor("USD")).toContain(0.25);
    expect(denominationsFor("XYZ")).toEqual([]);
  });

  it("avisa de lo que espera la segunda firma", async () => {
    listCountsAPI.mockResolvedValue({ me: YO, counts: [conteo()] });
    renderCon();

    expect(
      await screen.findByText(/Hay 1 conteo esperando la segunda firma/)
    ).toBeInTheDocument();
    expect(screen.getByText("Culto del domingo")).toBeInTheDocument();
    expect(screen.getByText("4 × S/ 50.00")).toBeInTheDocument();
  });

  it("quien contó no ve el botón de firmar su propio conteo", async () => {
    //! El conteo es mío: el control es que lo firme otra persona
    listCountsAPI.mockResolvedValue({
      me: YO,
      counts: [conteo({ countedBy: { _id: YO, username: "yo" } })],
    });
    renderCon();

    expect(await screen.findByText(/Tiene que firmarla otra persona/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Firmar y asentar/ })).not.toBeInTheDocument();
  });

  it("otra persona sí puede firmar, y eso asienta el movimiento", async () => {
    listCountsAPI.mockResolvedValue({ me: YO, counts: [conteo()] });
    confirmCountAPI.mockResolvedValue(conteo({ status: "confirmado" }));
    renderCon();

    fireEvent.click(await screen.findByRole("button", { name: /Firmar y asentar/ }));
    await waitFor(() => expect(confirmCountAPI).toHaveBeenCalled());
    expect(confirmCountAPI.mock.calls[0][0]).toBe("c1");
  });

  it("un conteo ya firmado muestra los dos nombres y ningún botón", async () => {
    listCountsAPI.mockResolvedValue({
      me: YO,
      counts: [
        conteo({
          status: "confirmado",
          confirmedBy: { _id: YO, username: "marta_tesorera" },
        }),
      ],
    });
    renderCon();

    expect(
      await screen.findByText(/Firmado por pastor_juan y marta_tesorera/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Firmar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Descartar/ })).not.toBeInTheDocument();
  });

  it("el conteo se manda con su desglose y el total sale de la hoja", async () => {
    createCountAPI.mockResolvedValue(conteo());
    renderCon();

    fireEvent.click(await screen.findByRole("button", { name: /Contar/ }));

    fireEvent.change(screen.getByLabelText("Cuántos de S/ 50.00"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Cuántos de S/ 20.00"), { target: { value: "3" } });

    //! El botón dice el total, para que se vea antes de guardar
    const guardar = screen.getByRole("button", { name: /Guardar el conteo de S\/\s?260\.00/ });
    fireEvent.click(guardar);

    await waitFor(() => expect(createCountAPI).toHaveBeenCalled());
    expect(createCountAPI.mock.calls[0][0]).toMatchObject({
      service: "Culto del domingo",
      breakdown: [
        { value: 50, count: 4 },
        { value: 20, count: 3 },
      ],
    });
  });

  it("sin nada contado no deja guardar", async () => {
    renderCon();
    fireEvent.click(await screen.findByRole("button", { name: /Contar/ }));
    expect(screen.getByRole("button", { name: /Guardar el conteo/ })).toBeDisabled();
    expect(createCountAPI).not.toHaveBeenCalled();
  });

  it("un auditor ve los conteos pero no cuenta ni firma", async () => {
    listCountsAPI.mockResolvedValue({ me: YO, counts: [conteo()] });
    renderCon({ workspaces: AUDITOR });

    expect(await screen.findByText("Culto del domingo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Contar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Firmar y asentar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Descartar/ })).not.toBeInTheDocument();
  });

  it("en un espacio personal esta pantalla no existe", async () => {
    renderCon({ workspaces: EN_PERSONAL, currentId: "w2" });

    await waitFor(() => expect(screen.getByText("panel")).toBeInTheDocument());
    expect(listCountsAPI).not.toHaveBeenCalled();
  });
});
