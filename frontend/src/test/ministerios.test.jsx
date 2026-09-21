import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import MinistriesPage from "../components/Ministries/MinistriesPage";
import TransactionForm from "../components/Transactions/TransactionForm";
import PermissionRoute from "../components/Auth/PermissionRoute";
import { visibleNavItems } from "../components/layout/navItems";

const IGLESIA = { _id: "w-iglesia", name: "Iglesia Betel", kind: "iglesia", currency: "PEN", isDefault: true };
const PERSONAL = { _id: "w-casa", name: "Mis finanzas", kind: "personal", currency: "PEN", isDefault: true };

const rol = (role, permissions, base = IGLESIA) => [{ ...base, role, permissions }];
const TESORERO = rol("tesorero", [
  "tx:read",
  "tx:write",
  "category:write",
  "ministry:manage",
  "ministry:read",
]);
const AUDITOR = rol("auditor", ["tx:read", "ministry:read"]);
//! El líder de un ministerio a propósito NO tiene tx:read: no ve el libro
const LIDER = rol("lider", ["ministry:own"]);
const EN_PERSONAL = rol("propietario", ["tx:read", "tx:write", "category:write"], PERSONAL);

const listWorkspacesAPI = vi.fn();
//! Tal como responde GET /workspaces/:id/members: `userId`, no `_id`
const listMembersAPI = vi.fn(async () => [
  { userId: "u-pastor", username: "pastor", role: "propietario", isMe: true },
  { userId: "u-ana", username: "ana", role: "lider", isMe: false },
]);
vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: (...args) => listWorkspacesAPI(...args),
  listMembersAPI: (...args) => listMembersAPI(...args),
  getWorkspaceAPI: vi.fn(),
}));

const listMinistriesAPI = vi.fn();
const listMinistryExpensesAPI = vi.fn(async () => []);
const createMinistryAPI = vi.fn();
const updateMinistryAPI = vi.fn();
const deleteMinistryAPI = vi.fn();
vi.mock("../services/ministries/ministryService", () => ({
  listMinistriesAPI: (...args) => listMinistriesAPI(...args),
  listMinistryExpensesAPI: (...args) => listMinistryExpensesAPI(...args),
  createMinistryAPI: (...args) => createMinistryAPI(...args),
  updateMinistryAPI: (...args) => updateMinistryAPI(...args),
  deleteMinistryAPI: (...args) => deleteMinistryAPI(...args),
}));

const addTransactionAPI = vi.fn();
vi.mock("../services/transactions/transactionService", () => ({
  addTransactionAPI: (...args) => addTransactionAPI(...args),
  updateTransactionAPI: vi.fn(),
  attachReceiptAPI: vi.fn(),
  listTransationsAPI: vi.fn(async () => ({ transactions: [], total: 0 })),
}));

vi.mock("../services/category/categoryService", () => ({
  listCategoriesAPI: vi.fn(async () => [
    { _id: "c1", name: "mantenimiento", type: "expense", icon: "🔧" },
    { _id: "c2", name: "ofrendas", type: "income", icon: "💝" },
  ]),
}));

vi.mock("../services/funds/fundService", () => ({
  listFundsAPI: vi.fn(async () => [
    { _id: null, name: "General", icon: "🏛️", general: true, archived: false, balance: 0 },
  ]),
}));

vi.mock("../services/donors/donorService", () => ({
  listDonorsAPI: vi.fn(async () => ({ year: 2026, donors: [] })),
}));

const JOVENES = {
  _id: "m-jovenes",
  name: "Jóvenes",
  icon: "🔥",
  year: 2026,
  budget: 1000,
  archived: false,
  leader: { _id: "u-ana", username: "ana" },
  spent: 300,
  expenses: 2,
  remaining: 700,
  percent: 30,
  warning: false,
  exceeded: false,
};
const DAMAS = {
  _id: "m-damas",
  name: "Damas",
  icon: "🌷",
  year: 2026,
  budget: 500,
  archived: false,
  leader: null,
  spent: 600,
  expenses: 3,
  remaining: -100,
  percent: 120,
  warning: false,
  exceeded: true,
};
const VIEJO = {
  ...JOVENES,
  _id: "m-viejo",
  name: "Escuela vieja",
  icon: "📚",
  archived: true,
  budget: 200,
  spent: 0,
  expenses: 0,
  remaining: 200,
  percent: 0,
  leader: null,
};

const renderCon = (ui, { ruta = "/", workspaces = TESORERO, rutas = null } = {}) => {
  listWorkspacesAPI.mockResolvedValue(workspaces);
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: {
      auth: { user: { id: "u-ana", role: "user" }, token: "token" },
      workspace: { currentId: workspaces[0]._id },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>{rutas || <Route path="/" element={ui} />}</Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

describe("Ministerios", () => {
  beforeEach(() => {
    addTransactionAPI.mockReset();
    createMinistryAPI.mockReset();
    listMembersAPI.mockClear();
    listMinistryExpensesAPI.mockClear();
    listMinistriesAPI.mockReset();
    listMinistriesAPI.mockResolvedValue({
      year: 2026,
      currency: "PEN",
      ministries: [JOVENES, DAMAS, VIEJO],
    });
  });

  it("la tesorería ve el avance de cada ministerio y a quién se le pasó", async () => {
    renderCon(<MinistriesPage />);

    expect(await screen.findByText("Jóvenes")).toBeInTheDocument();
    expect(screen.getByText("de S/ 1,000.00")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("Quedan S/ 700.00")).toBeInTheDocument();
    expect(screen.getByText("Lo lleva ana")).toBeInTheDocument();

    //! Pasarse avisa, pero la app no bloquea nada
    expect(screen.getByText("Damas se pasó de su presupuesto.")).toBeInTheDocument();
    expect(screen.getByText("Se pasó por S/ 100.00")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Nuevo/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Jóvenes" })).toBeInTheDocument();
    //! Un ministerio con gastos se archiva, no se borra
    expect(screen.queryByRole("button", { name: "Borrar Jóvenes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Borrar Escuela vieja" })).toBeInTheDocument();
  });

  it("al crear un ministerio se manda quién lo lleva", async () => {
    createMinistryAPI.mockResolvedValue({ _id: "m-nuevo" });
    renderCon(<MinistriesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Nuevo/ }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Misiones" } });
    fireEvent.change(screen.getByLabelText(/Presupuesto/), { target: { value: "800" } });

    //! Cada miembro sale con su rol, para ver quién puede llegar a su presupuesto
    const lider = await screen.findByRole("combobox", { name: /Quién lo lleva/ });
    expect(screen.getByRole("option", { name: /ana · Líder de ministerio/ })).toBeInTheDocument();
    fireEvent.change(lider, { target: { value: "u-ana" } });

    fireEvent.click(screen.getByRole("button", { name: "Crear el ministerio" }));
    await waitFor(() => expect(createMinistryAPI).toHaveBeenCalled());
    expect(createMinistryAPI.mock.calls[0][0]).toMatchObject({
      name: "Misiones",
      budget: 800,
      leader: "u-ana",
    });
  });

  it("el año se cambia y se vuelve a pedir", async () => {
    renderCon(<MinistriesPage />);
    await screen.findByText("Jóvenes");
    const actual = new Date().getFullYear();
    expect(listMinistriesAPI).toHaveBeenCalledWith(actual);

    fireEvent.click(screen.getByRole("button", { name: "Año anterior" }));
    await waitFor(() => expect(listMinistriesAPI).toHaveBeenCalledWith(actual - 1));
  });

  it("un auditor ve los presupuestos pero no los toca", async () => {
    renderCon(<MinistriesPage />, { workspaces: AUDITOR });

    expect(await screen.findByRole("heading", { name: "Ministerios" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nuevo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Jóvenes" })).not.toBeInTheDocument();
  });

  it("el líder ve solo el suyo, con sus gastos, y no puede cambiar nada", async () => {
    listMinistriesAPI.mockResolvedValue({ year: 2026, currency: "PEN", ministries: [JOVENES] });
    listMinistryExpensesAPI.mockResolvedValue([
      {
        _id: "t1",
        date: "2026-09-10",
        category: "mantenimiento",
        description: "Sillas del salón",
        amount: 300,
        hasReceipt: true,
      },
    ]);
    renderCon(<MinistriesPage />, { workspaces: LIDER });

    expect(await screen.findByRole("heading", { name: "Mi ministerio" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nuevo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Jóvenes" })).not.toBeInTheDocument();
    //! No se le piden los miembros del espacio: no los puede ver
    expect(listMembersAPI).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Ver los 2 gastos" }));
    expect(await screen.findByText("Sillas del salón")).toBeInTheDocument();
    expect(screen.getByText(/con recibo/)).toBeInTheDocument();
  });

  it("el líder aterriza en su presupuesto en vez de en el Inicio", async () => {
    renderCon(null, {
      ruta: "/dashboard",
      workspaces: LIDER,
      rutas: (
        <>
          <Route
            path="/dashboard"
            element={
              <PermissionRoute permission="tx:read" redirectTo="/ministerios">
                <p>el libro del espacio</p>
              </PermissionRoute>
            }
          />
          <Route path="/ministerios" element={<p>mi presupuesto</p>} />
        </>
      ),
    });

    expect(await screen.findByText("mi presupuesto")).toBeInTheDocument();
    expect(screen.queryByText("el libro del espacio")).not.toBeInTheDocument();
  });

  it("la sección solo aparece en una iglesia y a quien la puede ver", () => {
    const paraNav = (workspaces) => {
      const { permissions, ...workspace } = workspaces[0];
      return { can: (p) => permissions.includes(p), workspace, isAdmin: false };
    };

    const delTesorero = visibleNavItems(paraNav(TESORERO));
    expect(delTesorero.some((i) => i.to === "/ministerios")).toBe(true);

    //! En un espacio personal no hay ministerios
    expect(visibleNavItems(paraNav(EN_PERSONAL)).some((i) => i.to === "/ministerios")).toBe(false);

    //! El líder no ve el libro: le queda su ministerio y poco más
    const delLider = visibleNavItems(paraNav(LIDER));
    expect(delLider.map((i) => i.to)).toEqual(["/ministerios", "/espacios", "/profile"]);
    //! Y por eso su ministerio va en la barra de abajo, a mano
    expect(delLider.find((i) => i.to === "/ministerios").primary).toBe(true);
    expect(delTesorero.find((i) => i.to === "/ministerios").primary).toBe(false);
  });

  it("un gasto se carga a un ministerio; un ingreso nunca", async () => {
    addTransactionAPI.mockResolvedValue([{ _id: "t-nuevo" }]);
    renderCon(<TransactionForm />);

    fireEvent.click(await screen.findByRole("button", { name: /Mantenimiento/ }));
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: "0" }));

    const ministerio = await screen.findByRole("combobox", { name: "Ministerio" });
    //! Los archivados no se ofrecen
    expect(screen.queryByRole("option", { name: /Escuela vieja/ })).not.toBeInTheDocument();
    fireEvent.change(ministerio, { target: { value: "m-jovenes" } });

    fireEvent.click(screen.getByRole("button", { name: /Registrar gasto/ }));
    await waitFor(() => expect(addTransactionAPI).toHaveBeenCalled());
    expect(addTransactionAPI.mock.calls[0][0]).toMatchObject({
      type: "expense",
      amount: 50,
      ministry: "m-jovenes",
    });

    //! Un ingreso no se carga a un presupuesto de gasto
    fireEvent.click(screen.getByRole("radio", { name: "Ingreso" }));
    expect(screen.queryByRole("combobox", { name: "Ministerio" })).not.toBeInTheDocument();
  });

  it("quien no ve ministerios no manda el campo al registrar", async () => {
    addTransactionAPI.mockResolvedValue([{ _id: "t-nuevo" }]);
    renderCon(<TransactionForm />, { workspaces: EN_PERSONAL });

    fireEvent.click(await screen.findByRole("button", { name: /Mantenimiento/ }));
    fireEvent.click(screen.getByRole("button", { name: "9" }));
    fireEvent.click(screen.getByRole("button", { name: /Registrar gasto/ }));

    await waitFor(() => expect(addTransactionAPI).toHaveBeenCalled());
    expect(addTransactionAPI.mock.calls[0][0]).not.toHaveProperty("ministry");
    expect(listMinistriesAPI).not.toHaveBeenCalled();
  });
});
