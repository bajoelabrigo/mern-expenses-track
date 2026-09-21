import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import AvisosPage from "../components/Notificaciones/AvisosPage";
import AvisosBell from "../components/Notificaciones/AvisosBell";

const IGLESIA = {
  _id: "w-iglesia",
  name: "Iglesia Betel",
  kind: "iglesia",
  currency: "PEN",
  isDefault: true,
  role: "tesorero",
  permissions: ["tx:read", "tx:write"],
};

const listWorkspacesAPI = vi.fn();
vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: (...a) => listWorkspacesAPI(...a),
  getWorkspaceAPI: vi.fn(),
}));

const listNotificationsAPI = vi.fn();
const markNotificationsReadAPI = vi.fn();
const pushStatusAPI = vi.fn();
const subscribePushAPI = vi.fn();
const unsubscribePushAPI = vi.fn();
const testPushAPI = vi.fn();

vi.mock("../services/notifications/notificationService", () => ({
  listNotificationsAPI: (...a) => listNotificationsAPI(...a),
  markNotificationsReadAPI: (...a) => markNotificationsReadAPI(...a),
  pushStatusAPI: (...a) => pushStatusAPI(...a),
  subscribePushAPI: (...a) => subscribePushAPI(...a),
  unsubscribePushAPI: (...a) => unsubscribePushAPI(...a),
  testPushAPI: (...a) => testPushAPI(...a),
}));

//! El Web Push del navegador se sustituye entero: lo que se prueba es lo que
//! hace la pantalla (pedir permiso, suscribir, avisar al servidor), no Chrome.
const webpush = {
  soportado: vi.fn(() => true),
  permiso: vi.fn(() => "default"),
  esIOS: vi.fn(() => false),
  instalada: vi.fn(() => false),
  suscripcionActual: vi.fn(async () => null),
  suscribir: vi.fn(),
  quitar: vi.fn(),
};

vi.mock("../lib/push", () => ({
  soportado: (...a) => webpush.soportado(...a),
  permiso: (...a) => webpush.permiso(...a),
  esIOS: (...a) => webpush.esIOS(...a),
  instalada: (...a) => webpush.instalada(...a),
  suscripcionActual: (...a) => webpush.suscripcionActual(...a),
  suscribir: (...a) => webpush.suscribir(...a),
  quitar: (...a) => webpush.quitar(...a),
}));

const AVISO = {
  _id: "a1",
  actorName: "pastor",
  entity: "transaction",
  accion: "registró un gasto",
  detalle: "S/ 280,00 · «Honorarios»",
  url: "/movimientos",
  createdAt: new Date().toISOString(),
  read: false,
};

const renderCon = (ui, ruta = "/avisos") => {
  listWorkspacesAPI.mockResolvedValue([IGLESIA]);
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: {
      auth: { user: { id: "u1", username: "tesorera", role: "user" }, token: "token" },
      workspace: { currentId: IGLESIA._id },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/avisos" element={ui} />
            <Route path="/movimientos" element={<p>movimientos</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

//! El botón está deshabilitado hasta que el servidor contesta si puede mandar
//! avisos: hay que esperar a que se habilite, no solo a que aparezca.
const pulsarActivar = async () => {
  const boton = await screen.findByRole("button", { name: /Activar en este aparato/ });
  await waitFor(() => expect(boton).toBeEnabled());
  fireEvent.click(boton);
};

describe("La campana de avisos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listNotificationsAPI.mockResolvedValue({ items: [], unread: 0 });
    pushStatusAPI.mockResolvedValue({ disponible: false, publicKey: null, aparatos: [] });
    webpush.soportado.mockReturnValue(true);
    webpush.permiso.mockReturnValue("default");
    webpush.esIOS.mockReturnValue(false);
    webpush.suscripcionActual.mockResolvedValue(null);
  });

  it("dice cuántos avisos hay sin ver", async () => {
    listNotificationsAPI.mockResolvedValue({ items: [AVISO], unread: 3 });

    renderCon(<AvisosBell />);

    expect(await screen.findByRole("link", { name: "Avisos, 3 sin ver" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("pasa de 9 a «9+» en vez de un número largo", async () => {
    listNotificationsAPI.mockResolvedValue({ items: [AVISO], unread: 42 });

    renderCon(<AvisosBell />);

    expect(await screen.findByRole("link", { name: "Avisos, 42 sin ver" })).toBeInTheDocument();
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("sin nada sin ver no lleva número", async () => {
    renderCon(<AvisosBell />);

    expect(await screen.findByRole("link", { name: "Avisos" })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

describe("La pantalla de avisos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listNotificationsAPI.mockResolvedValue({ items: [], unread: 0 });
    markNotificationsReadAPI.mockResolvedValue({ unread: 0 });
    pushStatusAPI.mockResolvedValue({ disponible: false, publicKey: null, aparatos: [] });
    webpush.soportado.mockReturnValue(true);
    webpush.permiso.mockReturnValue("default");
    webpush.esIOS.mockReturnValue(false);
    webpush.suscripcionActual.mockResolvedValue(null);
  });

  it("cuenta de quién es cada cambio y lleva a su pantalla", async () => {
    listNotificationsAPI.mockResolvedValue({ items: [AVISO], unread: 1 });

    renderCon(<AvisosPage />);

    const fila = await screen.findByRole("link", { name: /pastor registró un gasto/ });
    expect(fila).toHaveAttribute("href", "/movimientos");
    expect(screen.getByText(/S\/ 280,00/)).toBeInTheDocument();
  });

  it("al abrirla da los avisos por vistos", async () => {
    listNotificationsAPI.mockResolvedValue({ items: [AVISO], unread: 2 });

    renderCon(<AvisosPage />);

    await waitFor(() => expect(markNotificationsReadAPI).toHaveBeenCalled());
  });

  it("sin avisos explica de dónde salen", async () => {
    renderCon(<AvisosPage />);

    expect(await screen.findByText(/Todavía no hay avisos/)).toBeInTheDocument();
    expect(screen.getByText(/Lo que hagas tú no se te avisa/)).toBeInTheDocument();
  });

  it("avisa cuando el servidor no tiene las claves, en vez de ofrecer algo que no funciona", async () => {
    renderCon(<AvisosPage />);

    expect(await screen.findByText(/no tiene las claves para mandar avisos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Activar en este aparato/ })).toBeDisabled();
  });

  it("activar pide permiso, suscribe el aparato y lo apunta en el servidor", async () => {
    pushStatusAPI.mockResolvedValue({ disponible: true, publicKey: "clave-publica", aparatos: [] });
    const suscripcion = { endpoint: "https://push.test/1", toJSON: () => ({ endpoint: "https://push.test/1", keys: { p256dh: "p", auth: "a" } }) };
    webpush.suscribir.mockResolvedValue(suscripcion);
    subscribePushAPI.mockResolvedValue({ endpoint: "https://push.test/1" });
    vi.stubGlobal("Notification", { requestPermission: vi.fn(async () => "granted") });

    renderCon(<AvisosPage />);

    await pulsarActivar();

    await waitFor(() => expect(subscribePushAPI).toHaveBeenCalledWith(suscripcion.toJSON()));
    expect(webpush.suscribir).toHaveBeenCalledWith("clave-publica");
    expect(await screen.findByText("Avisos activados en este aparato.")).toBeInTheDocument();
  });

  it("si no da permiso, lo dice y no suscribe nada", async () => {
    pushStatusAPI.mockResolvedValue({ disponible: true, publicKey: "clave-publica", aparatos: [] });
    vi.stubGlobal("Notification", { requestPermission: vi.fn(async () => "denied") });

    renderCon(<AvisosPage />);

    await pulsarActivar();

    expect(
      await screen.findByText(/No diste permiso para mostrar avisos/)
    ).toBeInTheDocument();
    expect(webpush.suscribir).not.toHaveBeenCalled();
    expect(subscribePushAPI).not.toHaveBeenCalled();
  });

  it("con los avisos ya activos ofrece probarlos y apagarlos", async () => {
    pushStatusAPI.mockResolvedValue({ disponible: true, publicKey: "clave-publica", aparatos: [] });
    webpush.suscripcionActual.mockResolvedValue({ endpoint: "https://push.test/1" });
    testPushAPI.mockResolvedValue({ message: "Enviado a 1 aparato" });

    renderCon(<AvisosPage />);

    expect(await screen.findByText("Activados en este aparato")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Probar/ }));
    expect(await screen.findByText("Enviado a 1 aparato")).toBeInTheDocument();
  });

  it("en iPhone sin instalar avisa de que hay que añadirla a la pantalla de inicio", async () => {
    webpush.esIOS.mockReturnValue(true);
    webpush.instalada.mockReturnValue(false);

    renderCon(<AvisosPage />);

    expect(await screen.findByText(/Añadir a pantalla de inicio/)).toBeInTheDocument();
  });
});
