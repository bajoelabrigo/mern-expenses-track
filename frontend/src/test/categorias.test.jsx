import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import CategoriesList from "../components/category/CategoriesList";

const IGLESIA = {
  _id: "w-iglesia",
  name: "Iglesia Ejemplo",
  kind: "iglesia",
  currency: "PEN",
  isDefault: true,
  role: "propietario",
  permissions: ["tx:read", "tx:write", "category:write"],
};

const PERSONAL = { ...IGLESIA, _id: "w-personal", name: "Mis finanzas", kind: "personal" };

const listWorkspacesAPI = vi.fn();
vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: (...a) => listWorkspacesAPI(...a),
  getWorkspaceAPI: vi.fn(),
}));

const listCategoriesAPI = vi.fn();
const deleteCategoryAPI = vi.fn();
const addDefaultCategoriesAPI = vi.fn();
vi.mock("../services/category/categoryService", () => ({
  listCategoriesAPI: (...a) => listCategoriesAPI(...a),
  deleteCategoryAPI: (...a) => deleteCategoryAPI(...a),
  addDefaultCategoriesAPI: (...a) => addDefaultCategoriesAPI(...a),
  addCategoryAPI: vi.fn(),
  updateCategoryAPI: vi.fn(),
  getCategoryByIdAPI: vi.fn(),
}));

const DE_INGRESO = [
  { _id: "c1", name: "diezmos", type: "income", icon: "🙏", incomeKind: "diezmo" },
  { _id: "c2", name: "ofrendas", type: "income", icon: "💝", incomeKind: "ofrenda" },
  { _id: "c3", name: "primicias", type: "income", icon: "🌾", incomeKind: "primicia" },
  { _id: "c4", name: "ofrenda especial", type: "income", icon: "🎁", incomeKind: "especial" },
];

const DE_GASTO = [
  { _id: "c5", name: "servicios", type: "expense", icon: "🔧", incomeKind: null },
  { _id: "c6", name: "alquiler", type: "expense", icon: "🏠", incomeKind: null },
];

const renderCon = (espacio = IGLESIA) => {
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
        <MemoryRouter initialEntries={["/categories"]}>
          <Routes>
            <Route path="/categories" element={<CategoriesList />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

describe("Categorías: las de fábrica", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addDefaultCategoriesAPI.mockResolvedValue({ added: [] });
  });

  it("un espacio sin ninguna ofrece ponerlas, y las pide", async () => {
    listCategoriesAPI.mockResolvedValue([]);

    renderCon(PERSONAL);

    expect(await screen.findByText("Sin categorías para empezar")).toBeInTheDocument();
    //! No se le ofrecen dos veces lo mismo (el aviso tapa el estado vacío)
    expect(screen.queryByText("Todavía no hay categorías")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ponerlas" }));
    await waitFor(() => expect(addDefaultCategoriesAPI).toHaveBeenCalled());
  });

  it("una iglesia sin las de ingreso ve cuáles le faltan", async () => {
    listCategoriesAPI.mockResolvedValue(DE_GASTO);

    renderCon(IGLESIA);

    expect(await screen.findByText("Faltan categorías de iglesia")).toBeInTheDocument();
    expect(
      screen.getByText(/Diezmos, Ofrendas, Primicias y Ofrendas especiales/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ponerlas" }));
    await waitFor(() => expect(addDefaultCategoriesAPI).toHaveBeenCalled());
  });

  it("con las de ingreso puestas no se ofrece nada", async () => {
    listCategoriesAPI.mockResolvedValue([...DE_INGRESO, ...DE_GASTO]);

    renderCon(IGLESIA);

    expect(await screen.findByText("Diezmos")).toBeInTheDocument();
    expect(screen.queryByText("Faltan categorías de iglesia")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ponerlas" })).not.toBeInTheDocument();
  });

  it("en Mis finanzas no se habla de categorías de iglesia", async () => {
    listCategoriesAPI.mockResolvedValue(DE_GASTO);

    renderCon(PERSONAL);

    expect(await screen.findByText("Servicios")).toBeInTheDocument();
    expect(screen.queryByText("Faltan categorías de iglesia")).not.toBeInTheDocument();
  });

  it("a quien solo puede leer no se le ofrece el botón", async () => {
    listCategoriesAPI.mockResolvedValue([]);

    renderCon({ ...IGLESIA, role: "lector", permissions: ["tx:read"] });

    expect(await screen.findByText("Todavía no hay categorías")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ponerlas" })).not.toBeInTheDocument();
  });
});
