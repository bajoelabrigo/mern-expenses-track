import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PublicReport from "../components/Public/PublicReport";
import PublicLinkCard from "../components/Workspaces/PublicLinkCard";

const getPublicReportAPI = vi.fn();
const getPublicLinkAPI = vi.fn();
const createPublicLinkAPI = vi.fn();
const updatePublicLinkAPI = vi.fn();
const removePublicLinkAPI = vi.fn();
vi.mock("../services/workspaces/publicLinkService", () => ({
  getPublicReportAPI: (...a) => getPublicReportAPI(...a),
  getPublicLinkAPI: (...a) => getPublicLinkAPI(...a),
  createPublicLinkAPI: (...a) => createPublicLinkAPI(...a),
  updatePublicLinkAPI: (...a) => updatePublicLinkAPI(...a),
  removePublicLinkAPI: (...a) => removePublicLinkAPI(...a),
}));

const IGLESIA = { _id: "w1", name: "Iglesia Betel", kind: "iglesia", currency: "PEN" };

const RESUMEN = {
  church: "Iglesia Betel",
  logo: "",
  currency: "PEN",
  period: "mes",
  year: 2026,
  month: 9,
  opening: 12086,
  income: 5229.5,
  expense: 3489.4,
  result: 1740.1,
  closing: 13826.1,
  incomeBreakdown: [
    { kind: "diezmo", amount: 3076 },
    { kind: "ofrenda", amount: 1023.5 },
  ],
  expenseBreakdown: [{ category: "alquiler del local", amount: 2000 }],
  months: null,
  funds: [
    { name: "General", amount: 13332.3 },
    { name: "Día de Acción de Gracias", amount: 493.8 },
  ],
};

const renderCon = (ui, ruta = "/cuentas/abc") => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/cuentas/:token" element={ui} />
          <Route path="/ajustes" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("Enlace para la congregación", () => {
  beforeEach(() => {
    [getPublicReportAPI, getPublicLinkAPI, createPublicLinkAPI, updatePublicLinkAPI, removePublicLinkAPI]
      .forEach((m) => m.mockReset());
    getPublicLinkAPI.mockResolvedValue(null);
  });

  it("la congregación ve los totales del mes y cómo está repartido", async () => {
    getPublicReportAPI.mockResolvedValue(RESUMEN);
    renderCon(<PublicReport />);

    expect(await screen.findByRole("heading", { name: "Iglesia Betel" })).toBeInTheDocument();
    expect(screen.getByText("Cuentas de septiembre de 2026")).toBeInTheDocument();
    expect(screen.getByText("S/ 13,826.10")).toBeInTheDocument();
    expect(screen.getByText("Diezmos")).toBeInTheDocument();
    expect(screen.getByText("Alquiler del local")).toBeInTheDocument();
    expect(screen.getByText("Día de Acción de Gracias")).toBeInTheDocument();
    //! Se pidió con el token de la dirección
    expect(getPublicReportAPI).toHaveBeenCalledWith("abc");
  });

  it("un enlace que ya no vale lo dice sin dar pistas", async () => {
    getPublicReportAPI.mockRejectedValue(new Error("404"));
    renderCon(<PublicReport />);

    expect(await screen.findByText("Este enlace ya no funciona")).toBeInTheDocument();
    //! Ni confirma ni desmiente que la iglesia exista
    expect(screen.queryByText(/Iglesia/)).not.toBeInTheDocument();
  });

  it("si la iglesia oculta los fondos, no se pintan", async () => {
    getPublicReportAPI.mockResolvedValue({ ...RESUMEN, funds: null });
    renderCon(<PublicReport />);

    await screen.findByRole("heading", { name: "Iglesia Betel" });
    expect(screen.queryByText("Cómo está repartido")).not.toBeInTheDocument();
  });

  it("avisa de lo que implica antes de crear el enlace", async () => {
    renderCon(<PublicLinkCard workspace={IGLESIA} />, "/ajustes");

    expect(
      await screen.findByText(/Cualquiera que tenga la dirección podrá verla/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Nunca aparecen los nombres de quienes dieron/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear el enlace" })).toBeInTheDocument();
  });

  it("la dirección se muestra una sola vez, al crearla", async () => {
    createPublicLinkAPI.mockResolvedValue({
      active: true,
      period: "mes",
      showFunds: true,
      hint: "abc123",
      views: 0,
      url: "https://ejemplo.test/cuentas/eltoken",
    });
    renderCon(<PublicLinkCard workspace={IGLESIA} />, "/ajustes");

    fireEvent.click(await screen.findByRole("button", { name: "Crear el enlace" }));

    expect(await screen.findByText("https://ejemplo.test/cuentas/eltoken")).toBeInTheDocument();
    expect(screen.getByText(/no se vuelve a mostrar/)).toBeInTheDocument();
  });

  it("con el enlace ya creado muestra su estado, no la dirección", async () => {
    getPublicLinkAPI.mockResolvedValue({
      active: true,
      period: "mes",
      showFunds: true,
      hint: "abc123",
      views: 7,
    });
    renderCon(<PublicLinkCard workspace={IGLESIA} />, "/ajustes");

    expect(await screen.findByText(/termina en …abc123/)).toBeInTheDocument();
    expect(screen.getByText(/Se ha abierto 7 veces/)).toBeInTheDocument();
    expect(screen.queryByText(/cuentas\//)).not.toBeInTheDocument();
  });

  it("se puede apagar y cambiar qué se publica", async () => {
    getPublicLinkAPI.mockResolvedValue({
      active: true,
      period: "mes",
      showFunds: true,
      hint: "abc123",
      views: 0,
    });
    updatePublicLinkAPI.mockResolvedValue({ active: false });
    renderCon(<PublicLinkCard workspace={IGLESIA} />, "/ajustes");

    fireEvent.click(await screen.findByRole("button", { name: "Apagar" }));
    await waitFor(() => expect(updatePublicLinkAPI).toHaveBeenCalled());
    expect(updatePublicLinkAPI.mock.calls[0][0]).toMatchObject({ id: "w1", active: false });

    fireEvent.change(screen.getByLabelText("Qué se publica"), { target: { value: "anio" } });
    await waitFor(() => expect(updatePublicLinkAPI).toHaveBeenCalledTimes(2));
    expect(updatePublicLinkAPI.mock.calls[1][0]).toMatchObject({ period: "anio" });
  });
});
