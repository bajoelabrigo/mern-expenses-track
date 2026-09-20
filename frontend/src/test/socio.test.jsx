import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import SupportCard from "../components/layout/SupportCard";
import { isAndroidApp } from "../lib/platform";

const getSupportStatusAPI = vi.fn();
vi.mock("../services/support/supportService", () => ({
  getSupportStatusAPI: (...args) => getSupportStatusAPI(...args),
  createSupportOrderAPI: vi.fn(),
  captureSupportAPI: vi.fn(),
}));

const renderCon = (ui) => {
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: {
      auth: { user: { id: "1", role: "user" }, token: "token" },
      workspace: { currentId: "w1" },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/socio"]}>
          <Routes>
            <Route path="/socio" element={ui} />
            <Route path="/dashboard" element={<p>panel</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

//! Simula que la página se abrió desde la app de Android (una TWA deja su
//! firma en el referrer)
const comoAppAndroid = (valor) =>
  Object.defineProperty(document, "referrer", {
    value: valor ? "android-app://com.controldegastos.app" : "",
    configurable: true,
  });

describe("Hazte socio", () => {
  beforeEach(() => {
    getSupportStatusAPI.mockReset();
    comoAppAndroid(false);
    window.sessionStorage.clear();
    //! Sin clave de PayPal la página no ofrece el pago, así que las pruebas
    //! que llegan al selector necesitan una
    vi.stubEnv("VITE_PAYPAL_CLIENT_ID", "clave-de-prueba");
  });
  afterEach(() => {
    comoAppAndroid(false);
    vi.unstubAllEnvs();
  });

  it("reconoce cuándo está dentro de la app de Android", () => {
    expect(isAndroidApp()).toBe(false);

    comoAppAndroid(true);
    expect(isAndroidApp()).toBe(true);

    //! El referrer solo llega en la primera carga: después se recuerda
    comoAppAndroid(false);
    expect(isAndroidApp()).toBe(true);
  });

  it("la invitación se ve en el navegador", () => {
    renderCon(<SupportCard />);
    expect(screen.getByRole("link", { name: /Hazte socio/ })).toHaveAttribute("href", "/socio");
  });

  it("la invitación NO se ve dentro de la app de Android", () => {
    //! Google Play prohíbe llevar a pagar por fuera desde una app de su tienda
    comoAppAndroid(true);
    const { container } = renderCon(<SupportCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sin PayPal configurado avisa en vez de ofrecer el pago", async () => {
    getSupportStatusAPI.mockResolvedValue({ disponible: false, total: 0, aportes: [] });
    const { default: SupportPage } = await import("../components/Support/SupportPage");
    renderCon(<SupportPage />);

    expect(await screen.findByText(/todavía no están disponibles/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "$10" })).not.toBeInTheDocument();
  });

  it("da las gracias a quien ya aportó", async () => {
    getSupportStatusAPI.mockResolvedValue({
      disponible: false,
      total: 25,
      aportes: [{ amount: 25, currency: "USD", paidAt: "2026-09-01" }],
    });
    const { default: SupportPage } = await import("../components/Support/SupportPage");
    renderCon(<SupportPage />);

    expect(await screen.findByText(/Ya has aportado 25 dólares/)).toBeInTheDocument();
  });

  it("dentro de la app de Android la página manda al panel", async () => {
    comoAppAndroid(true);
    getSupportStatusAPI.mockResolvedValue({ disponible: true, total: 0, aportes: [] });
    const { default: SupportPage } = await import("../components/Support/SupportPage");
    renderCon(<SupportPage />);

    await waitFor(() => expect(screen.getByText("panel")).toBeInTheDocument());
    //! Ni siquiera se pregunta por los aportes
    expect(getSupportStatusAPI).not.toHaveBeenCalled();
  });

  it("deja elegir cuánto aportar, con montos sueltos y a medida", async () => {
    getSupportStatusAPI.mockResolvedValue({ disponible: true, total: 0, aportes: [] });
    const { default: SupportPage } = await import("../components/Support/SupportPage");
    renderCon(<SupportPage />);

    const diez = await screen.findByRole("button", { name: "$10" });
    expect(diez).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "$20" }));
    expect(screen.getByRole("button", { name: "$20" })).toHaveAttribute("aria-pressed", "true");
    expect(diez).toHaveAttribute("aria-pressed", "false");

    //! Al escribir un monto propio, los de arriba se sueltan
    fireEvent.change(screen.getByLabelText(/Otro monto/), { target: { value: "35" } });
    expect(screen.getByRole("button", { name: "$20" })).toHaveAttribute("aria-pressed", "false");
  });
});
