import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import TransactionForm from "../components/Transactions/TransactionForm";

const IGLESIA = {
  _id: "w-iglesia",
  name: "Iglesia Betel",
  kind: "iglesia",
  currency: "PEN",
  isDefault: true,
};

const TESORERO = [
  {
    ...IGLESIA,
    role: "tesorero",
    permissions: ["tx:read", "tx:write", "donor:read", "donor:write", "ministry:read"],
  },
];

const listWorkspacesAPI = vi.fn();
vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: (...a) => listWorkspacesAPI(...a),
  getWorkspaceAPI: vi.fn(),
}));

//! Ana ofrenda y además cocina (recibe pagos); Betty está archivada
const listDonorsAPI = vi.fn(async () => ({
  year: 2026,
  donors: [
    { _id: "p-ana", name: "Ana Torres", given: 300, gifts: 2, paid: 120, payments: 1, archived: false },
    { _id: "p-betty", name: "Betty Ruiz", given: 0, gifts: 0, paid: 0, payments: 0, archived: true },
  ],
}));
vi.mock("../services/donors/donorService", () => ({
  listDonorsAPI: (...a) => listDonorsAPI(...a),
  downloadStatementAPI: vi.fn(),
  downloadPaymentStatementAPI: vi.fn(),
}));

vi.mock("../services/category/categoryService", () => ({
  listCategoriesAPI: vi.fn(async () => [
    { _id: "c1", name: "servicios", type: "expense", icon: "🔧" },
    { _id: "c2", name: "diezmos", type: "income", icon: "💝" },
  ]),
}));

vi.mock("../services/funds/fundService", () => ({
  listFundsAPI: vi.fn(async () => []),
}));

vi.mock("../services/ministries/ministryService", () => ({
  listMinistriesAPI: vi.fn(async () => []),
  listMinistryExpensesAPI: vi.fn(async () => []),
}));

const addTransactionAPI = vi.fn();
vi.mock("../services/transactions/transactionService", () => ({
  addTransactionAPI: (...a) => addTransactionAPI(...a),
  attachReceiptAPI: vi.fn(),
  updateTransactionAPI: vi.fn(),
}));

const renderCon = (workspaces = TESORERO) => {
  listWorkspacesAPI.mockResolvedValue(workspaces);
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: {
      auth: { user: { id: "u-1", role: "user" }, token: "token" },
      workspace: { currentId: IGLESIA._id },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<TransactionForm />} />
            <Route path="/dashboard" element={<p>panel de usuario</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

const ponerMonto = async (teclas) => {
  fireEvent.click(await screen.findByRole("button", { name: /Servicios/ }));
  teclas.forEach((t) => fireEvent.click(screen.getByRole("button", { name: t })));
};

describe("Gastos: a quién se le pagó", () => {
  beforeEach(() => addTransactionAPI.mockReset());

  it("el gasto guarda a quién se le pagó y por qué", async () => {
    addTransactionAPI.mockResolvedValue([{ _id: "t-nuevo" }]);
    renderCon();
    await ponerMonto(["2", "5", "0"]);

    //! Solo se ofrecen las personas activas
    const persona = await screen.findByRole("combobox", { name: "Se le pagó a" });
    expect(screen.getByRole("option", { name: "Ana Torres" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Betty Ruiz/ })).not.toBeInTheDocument();

    //! El concepto solo aparece cuando hay alguien a quien se le pagó
    expect(screen.queryByRole("combobox", { name: "Por qué se le pagó" })).not.toBeInTheDocument();
    fireEvent.change(persona, { target: { value: "p-ana" } });

    fireEvent.change(await screen.findByRole("combobox", { name: "Por qué se le pagó" }), {
      target: { value: "jornal" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Registrar gasto/ }));
    await waitFor(() => expect(addTransactionAPI).toHaveBeenCalled());
    expect(addTransactionAPI.mock.calls[0][0]).toMatchObject({
      type: "expense",
      amount: 250,
      payee: "p-ana",
      paymentKind: "jornal",
    });
  });

  it("un gasto sin persona no manda concepto, y un ingreso no lleva a quién se le pagó", async () => {
    addTransactionAPI.mockResolvedValue([{ _id: "t-nuevo" }]);
    renderCon();
    await ponerMonto(["9"]);

    //! Sin elegir persona no se manda nada de esto
    fireEvent.click(screen.getByRole("button", { name: /Registrar gasto/ }));
    await waitFor(() => expect(addTransactionAPI).toHaveBeenCalled());
    expect(addTransactionAPI.mock.calls[0][0]).toMatchObject({ payee: null, paymentKind: null });

    //! Y al pasar a ingreso, el campo desaparece (ahí lo que hay es "Aportante")
    fireEvent.click(screen.getByRole("radio", { name: "Ingreso" }));
    expect(screen.queryByRole("combobox", { name: "Se le pagó a" })).not.toBeInTheDocument();
  });
});
