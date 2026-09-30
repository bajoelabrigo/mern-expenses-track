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
const createSubscriptionAPI = vi.fn();
const cancelSubscriptionAPI = vi.fn();
vi.mock("../services/support/supportService", () => ({
  getSupportStatusAPI: (...args) => getSupportStatusAPI(...args),
  createSupportOrderAPI: vi.fn(),
  captureSupportAPI: vi.fn(),
  createSubscriptionAPI: (...args) => createSubscriptionAPI(...args),
  cancelSubscriptionAPI: (...args) => cancelSubscriptionAPI(...args),
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
    createSubscriptionAPI.mockReset();
    cancelSubscriptionAPI.mockReset();
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

  it("los botones de PayPal se pintan una vez, no con cada tecla", async () => {
    getSupportStatusAPI.mockResolvedValue({ disponible: true, total: 0, aportes: [] });
    const dibujar = vi.fn(() => Promise.resolve());
    const botones = vi.fn(() => ({ render: dibujar, close: vi.fn() }));
    //! El SDK de PayPal ya cargado: así la página dibuja sus botones
    window.paypal = { Buttons: botones };

    const { default: SupportPage } = await import("../components/Support/SupportPage");
    renderCon(<SupportPage />);

    await screen.findByRole("button", { name: "$10" });
    await waitFor(() => expect(botones).toHaveBeenCalledTimes(1));

    //! Cambiar el importe NO debe rehacer los botones: el importe se lee al
    //! crear la orden, así que basta con pintarlos una vez. Si el manejador de
    //! error cambiara en cada pintado, aquí se destruirían y se volverían a
    //! crear con cada tecla.
    fireEvent.click(screen.getByRole("button", { name: "$20" }));
    fireEvent.change(screen.getByLabelText(/Otro monto/), { target: { value: "35" } });
    expect(screen.getByRole("button", { name: "$20" })).toBeInTheDocument();
    expect(botones).toHaveBeenCalledTimes(1);

    delete window.paypal;
  });

  //! ── Aporte mensual ──

  it("sin planes configurados no ofrece el aporte mensual", async () => {
    getSupportStatusAPI.mockResolvedValue({ disponible: true, total: 0, aportes: [], planes: [] });

    const { default: SupportPage } = await import("../components/Support/SupportPage");
    renderCon(<SupportPage />);

    await screen.findByRole("button", { name: "$10" });
    //! Un selector de una sola opción estorba más de lo que ayuda
    expect(screen.queryByRole("radio", { name: "Cada mes" })).not.toBeInTheDocument();
  });

  it("al elegir cada mes, lleva a PayPal con el monto pedido", async () => {
    getSupportStatusAPI.mockResolvedValue({
      disponible: true,
      total: 0,
      aportes: [],
      planes: [5, 10, 20],
    });
    createSubscriptionAPI.mockResolvedValue({ approvalUrl: "https://paypal.test/aprobar/I-1" });

    const { default: SupportPage } = await import("../components/Support/SupportPage");
    renderCon(<SupportPage />);

    fireEvent.click(await screen.findByRole("radio", { name: "Cada mes" }));

    //! El de una vez deja de verse: son dos caminos, no dos formularios a la vez
    expect(screen.queryByLabelText(/Otro monto/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "$20" }));
    fireEvent.click(screen.getByRole("button", { name: /Aportar \$20 cada mes/ }));

    //! Se mira solo el primer argumento: react-query le añade su contexto detrás
    await waitFor(() => expect(createSubscriptionAPI).toHaveBeenCalled());
    expect(createSubscriptionAPI.mock.calls[0][0]).toBe(20);
  });

  it("un monto a medida se cae al plan más cercano al pasar a mensual", async () => {
    getSupportStatusAPI.mockResolvedValue({
      disponible: true,
      total: 0,
      aportes: [],
      planes: [5, 10, 20],
    });

    const { default: SupportPage } = await import("../components/Support/SupportPage");
    renderCon(<SupportPage />);

    //! 35 vale como aporte de una vez, pero no existe como plan mensual
    fireEvent.change(await screen.findByLabelText(/Otro monto/), { target: { value: "35" } });
    fireEvent.click(screen.getByRole("radio", { name: "Cada mes" }));

    //! No deja un botón apagado sin explicación: elige el más cercano
    const boton = screen.getByRole("button", { name: /cada mes$/ });
    expect(boton).toHaveTextContent("Aportar $20 cada mes");
    expect(boton).toBeEnabled();
  });

  it("quien ya aporta cada mes lo ve, y puede cancelarlo", async () => {
    getSupportStatusAPI.mockResolvedValue({
      disponible: true,
      total: 30,
      aportes: [],
      planes: [5, 10, 20],
      suscripcion: { amount: 10, status: "activa" },
    });
    cancelSubscriptionAPI.mockResolvedValue({ ok: true });

    const { default: SupportPage } = await import("../components/Support/SupportPage");
    renderCon(<SupportPage />);

    await screen.findByText(/Aportas 10 dólares cada mes/);
    //! Con un compromiso vivo no se ofrece abrir otro
    expect(screen.queryByRole("radio", { name: "Cada mes" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar el aporte mensual/ }));
    await waitFor(() => expect(cancelSubscriptionAPI).toHaveBeenCalled());
  });

  it("una suscripción suspendida explica qué pasó en vez de callarse", async () => {
    getSupportStatusAPI.mockResolvedValue({
      disponible: true,
      total: 10,
      aportes: [],
      planes: [5, 10, 20],
      suscripcion: { amount: 5, status: "suspendida" },
    });

    const { default: SupportPage } = await import("../components/Support/SupportPage");
    renderCon(<SupportPage />);

    await screen.findByText(/no pudo hacer el último cobro/i);
  });
});
