import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import DonorsPage from "../components/Donors/DonorsPage";
import { visibleNavItems } from "../components/layout/navItems";

const IGLESIA = { _id: "w-iglesia", name: "Iglesia Betel", kind: "iglesia", currency: "PEN", isDefault: true };
const TESORERO = [
  { ...IGLESIA, role: "tesorero", permissions: ["tx:read", "tx:write", "donor:read", "donor:write"] },
];
const AUDITOR = [{ ...IGLESIA, role: "auditor", permissions: ["tx:read", "audit:read"] }];

const listWorkspacesAPI = vi.fn();
vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: (...args) => listWorkspacesAPI(...args),
  getWorkspaceAPI: vi.fn(),
}));

const downloadStatementsAPI = vi.fn();
vi.mock("../services/donors/donorService", () => ({
  downloadStatementsAPI: (...args) => downloadStatementsAPI(...args),
  listDonorsAPI: vi.fn(async () => ({
    year: 2026,
    donors: [
      { _id: "d1", name: "Marta Quispe", document: "45678912", given: 350.5, gifts: 2, archived: false },
      { _id: "d2", name: "Jorge Ríos", document: "", given: 0, gifts: 0, archived: true },
    ],
  })),
}));

const renderCon = (workspaces) => {
  listWorkspacesAPI.mockResolvedValue(workspaces);
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
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<DonorsPage />} />
            <Route path="/dashboard" element={<p>panel de usuario</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

describe("Aportantes", () => {
  it("la tesorería ve cuánto dio cada uno y los archivados aparte", async () => {
    renderCon(TESORERO);

    expect(await screen.findByText("Marta Quispe")).toBeInTheDocument();
    //! El mismo monto sale en el total del año y en su fila
    expect(screen.getAllByText("S/ 350.50")).toHaveLength(2);
    expect(screen.getByText("2 aportes en 2026")).toBeInTheDocument();
    expect(screen.getByText("Archivados · 1")).toBeInTheDocument();

    //! Y puede bajar las constancias del año
    fireEvent.click(screen.getByRole("button", { name: /Constancias de 2026/ }));
    await waitFor(() => expect(downloadStatementsAPI).toHaveBeenCalled());
    expect(downloadStatementsAPI.mock.calls[0][0]).toEqual({ year: new Date().getFullYear() });
  });

  it("el auditor no entra a la pantalla ni la ve en el menú", async () => {
    renderCon(AUDITOR);

    expect(await screen.findByText("panel de usuario")).toBeInTheDocument();
    expect(screen.queryByText("Marta Quispe")).not.toBeInTheDocument();

    const can = (permission) => AUDITOR[0].permissions.includes(permission);
    const items = visibleNavItems({ can, workspace: IGLESIA, isAdmin: false });
    expect(items.some((i) => i.to === "/aportantes")).toBe(false);
  });
});
