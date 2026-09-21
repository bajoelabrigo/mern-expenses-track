import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import WelcomeGuide from "../components/Users/WelcomeGuide";
import {
  buildSteps,
  finishGuide,
  guideProgress,
  hideGuide,
  isGuideHidden,
  isGuideRequested,
  showGuide,
} from "../lib/welcomeGuide";

//! ── Los cuatro espacios y roles que cambian los pasos ──
const IGLESIA = {
  _id: "w-iglesia",
  name: "Iglesia Betel",
  kind: "iglesia",
  currency: "PEN",
  isDefault: true,
  role: "propietario",
  permissions: ["tx:read", "tx:write", "fund:manage", "donor:read", "members:manage"],
};

const PERSONAL = { ...IGLESIA, _id: "w-personal", name: "Mis finanzas", kind: "personal" };

//! El contador registra y ve personas, pero no toca fondos ni miembros
const CONTADOR = {
  ...IGLESIA,
  role: "contador",
  permissions: ["tx:read", "tx:write", "category:write", "donor:read", "donor:write"],
};

const LECTOR = { ...IGLESIA, role: "lector", permissions: ["tx:read"] };

const listWorkspacesAPI = vi.fn();
const listMembersAPI = vi.fn();
const listFundsAPI = vi.fn();
const listDonorsAPI = vi.fn();

vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: (...a) => listWorkspacesAPI(...a),
  listMembersAPI: (...a) => listMembersAPI(...a),
  getWorkspaceAPI: vi.fn(),
}));

vi.mock("../services/funds/fundService", () => ({
  listFundsAPI: (...a) => listFundsAPI(...a),
}));

vi.mock("../services/donors/donorService", () => ({
  listDonorsAPI: (...a) => listDonorsAPI(...a),
}));

const renderCon = (ui, espacio = IGLESIA, ruta = "/") => {
  listWorkspacesAPI.mockResolvedValue([espacio]);
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: {
      auth: { user: { id: "u1", username: "pastor", role: "user" }, token: "token" },
      workspace: { currentId: espacio._id },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/" element={ui} />
            <Route path="/dashboard" element={<p>panel</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

//! El General es virtual: `hasFunds` mira los fondos de verdad
const SOLO_GENERAL = [{ _id: null, name: "General", general: true, archived: false }];
const UN_FONDO = [
  ...SOLO_GENERAL,
  { _id: "f1", name: "Misiones", general: false, archived: false },
];

describe("Guía de primeros pasos: qué pasos le tocan a cada uno", () => {
  const todos = [
    "tx:read",
    "tx:write",
    "fund:manage",
    "donor:read",
    "members:manage",
  ];
  const puede = (permisos) => (p) => permisos.includes(p);

  it("en una iglesia con el propietario son los cuatro", () => {
    const steps = buildSteps({ can: puede(todos), kind: "iglesia" });
    expect(steps.map((s) => s.id)).toEqual(["movimiento", "equipo", "fondo", "personas"]);
    expect(steps.every((s) => !s.done)).toBe(true);
  });

  it("en Mis finanzas no se ofrecen aportantes (no hay a quién)", () => {
    const steps = buildSteps({ can: puede(todos), kind: "personal" });
    expect(steps.map((s) => s.id)).toEqual(["movimiento", "equipo", "fondo"]);
  });

  it("al contador no se le piden fondos ni miembros", () => {
    const steps = buildSteps({
      can: puede(CONTADOR.permissions),
      kind: "iglesia",
    });
    expect(steps.map((s) => s.id)).toEqual(["movimiento", "personas"]);
  });

  it("cada paso se marca con su dato", () => {
    const steps = buildSteps({
      can: puede(todos),
      kind: "iglesia",
      hasMovimientos: true,
      hasFunds: true,
      miembros: 4,
      personas: 17,
    });
    expect(guideProgress(steps)).toEqual({ hechos: 4, total: 4, listo: true });
  });

  it("uno solo en el espacio todavía no es equipo", () => {
    const steps = buildSteps({ can: puede(todos), kind: "iglesia", miembros: 1 });
    expect(steps.find((s) => s.id === "equipo").done).toBe(false);
  });

  it("el estado guardado distingue ocultarla, terminarla y pedirla", () => {
    expect(isGuideHidden(IGLESIA._id, "u1")).toBe(false);

    hideGuide(IGLESIA._id, "u1");
    expect(isGuideHidden(IGLESIA._id, "u1")).toBe(true);

    finishGuide(IGLESIA._id, "u1");
    expect(isGuideHidden(IGLESIA._id, "u1")).toBe(true);

    //! Pedida manda: ni ocultarla ni terminarla la vuelven a esconder
    showGuide(IGLESIA._id, "u1");
    expect(isGuideHidden(IGLESIA._id, "u1")).toBe(false);
    expect(isGuideRequested(IGLESIA._id, "u1")).toBe(true);
  });
});

describe("Guía de primeros pasos en el Inicio", () => {
  beforeEach(() => {
    [listWorkspacesAPI, listMembersAPI, listFundsAPI, listDonorsAPI].forEach((m) => m.mockReset());
    listMembersAPI.mockResolvedValue([{ userId: "u1", username: "pastor", isMe: true }]);
    listFundsAPI.mockResolvedValue(SOLO_GENERAL);
    listDonorsAPI.mockResolvedValue({ year: 2026, donors: [] });
  });

  it("muestra lo que falta con su atajo", async () => {
    renderCon(<WelcomeGuide hasMovimientos={false} />);

    expect(await screen.findByText("0 de 4 listos. En unos minutos el espacio queda armado.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Registra el primer movimiento/ })).toHaveAttribute(
      "href",
      "/add-transaction"
    );
    expect(screen.getByRole("link", { name: /Suma a tu equipo/ })).toHaveAttribute(
      "href",
      "/espacio/miembros"
    );
    expect(screen.getByRole("link", { name: /Crea tu primer fondo/ })).toHaveAttribute("href", "/fondos");
    expect(screen.getByRole("link", { name: /Carga a las personas/ })).toHaveAttribute(
      "href",
      "/aportantes"
    );
  });

  it("lo que ya está hecho se marca y no se puede volver a pulsar", async () => {
    renderCon(<WelcomeGuide hasMovimientos />);

    expect(
      await screen.findByText("1 de 4 listos. En unos minutos el espacio queda armado.")
    ).toBeInTheDocument();
    //! Lo hecho es texto, no un enlace
    expect(screen.queryByRole("link", { name: /Registra el primer movimiento/ })).not.toBeInTheDocument();
    expect(screen.getByText("Registra el primer movimiento")).toBeInTheDocument();
    //! Y lo que falta sigue ofreciéndose, ya numerado en su sitio
    expect(screen.getByRole("link", { name: /Suma a tu equipo/ })).toBeInTheDocument();
  });

  it("terminada se apaga sola y no vuelve", async () => {
    listMembersAPI.mockResolvedValue([
      { userId: "u1", username: "pastor", isMe: true },
      { userId: "u2", username: "ana", isMe: false },
    ]);
    listFundsAPI.mockResolvedValue(UN_FONDO);
    listDonorsAPI.mockResolvedValue({ year: 2026, donors: [{ _id: "d1", name: "Ana" }] });

    const { container } = renderCon(<WelcomeGuide hasMovimientos />);

    //! Se apunta en el dispositivo: la próxima vez ya no se pregunta nada
    await waitFor(() => expect(isGuideHidden(IGLESIA._id, "u1")).toBe(true));
    expect(container).toBeEmptyDOMElement();

    //! Y una visita nueva a la misma pantalla tampoco la revive
    const otra = renderCon(<WelcomeGuide hasMovimientos />);
    await waitFor(() => expect(otra.container).toBeEmptyDOMElement());
  });

  it("Ocultar la apaga hasta que se pida de nuevo", async () => {
    const { container } = renderCon(<WelcomeGuide hasMovimientos={false} />);

    fireEvent.click(await screen.findByRole("button", { name: "Ocultar la guía de primeros pasos" }));

    expect(container).toBeEmptyDOMElement();
    expect(isGuideHidden(IGLESIA._id, "u1")).toBe(true);
  });

  it("pedida desde el Perfil vuelve aunque ya esté terminada", async () => {
    listMembersAPI.mockResolvedValue([
      { userId: "u1", username: "pastor", isMe: true },
      { userId: "u2", username: "ana", isMe: false },
    ]);
    listFundsAPI.mockResolvedValue(UN_FONDO);
    listDonorsAPI.mockResolvedValue({ year: 2026, donors: [{ _id: "d1", name: "Ana" }] });
    //! Es lo que hace el botón del Perfil
    showGuide(IGLESIA._id, "u1");

    const { container } = renderCon(<WelcomeGuide hasMovimientos />);

    expect(
      await screen.findByText("Ya está todo listo. Puedes cerrarla cuando quieras.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Registra el primer movimiento/ })).not.toBeInTheDocument();

    //! Y al cerrarla se apaga de verdad
    fireEvent.click(screen.getByRole("button", { name: "Ocultar la guía de primeros pasos" }));
    expect(container).toBeEmptyDOMElement();
    expect(isGuideHidden(IGLESIA._id, "u1")).toBe(true);
    expect(isGuideRequested(IGLESIA._id, "u1")).toBe(false);
  });

  it("a quien no registra no se le pregunta nada", async () => {
    renderCon(<WelcomeGuide hasMovimientos={false} />, LECTOR);

    //! Un lector no registra: no hay nada que pedirle
    await waitFor(() => expect(listDonorsAPI).not.toHaveBeenCalled());
    expect(screen.queryByText(/Primeros pasos/)).not.toBeInTheDocument();
    expect(listMembersAPI).not.toHaveBeenCalled();
  });

  it("al contador no se le pregunta por los miembros", async () => {
    renderCon(<WelcomeGuide hasMovimientos={false} />, CONTADOR);

    expect(await screen.findByRole("link", { name: /Registra el primer movimiento/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Suma a tu equipo/ })).not.toBeInTheDocument();
    expect(listMembersAPI).not.toHaveBeenCalled();
  });

  it("en Mis finanzas no se ofrecen aportantes", async () => {
    renderCon(<WelcomeGuide hasMovimientos={false} />, PERSONAL);

    expect(await screen.findByRole("link", { name: /Crea tu primer fondo/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Carga a las personas/ })).not.toBeInTheDocument();
    expect(listDonorsAPI).not.toHaveBeenCalled();
  });

  it("mientras no se sepa si hay movimientos, no se pinta", async () => {
    const { container } = renderCon(<WelcomeGuide hasMovimientos={null} />);
    await waitFor(() => expect(listFundsAPI).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
