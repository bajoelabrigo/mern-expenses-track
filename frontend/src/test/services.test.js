import { describe, it, expect, vi, beforeEach } from "vitest";

//! Se simula la instancia de axios para comprobar qué envía cada servicio
const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();

vi.mock("../lib/axios", () => ({
  axiosInstance: { get, post, put, delete: del },
  getErrorMessage: (error, fallback = "error") =>
    error?.response?.data?.message || fallback,
}));

const { loginAPI, changePasswordAPI } = await import(
  "../services/users/userService"
);
const {
  addTransactionAPI,
  exportTransactionExcelAPI,
  getTransactionByPeriodAPI,
  updateTransactionAPI,
} = await import("../services/transactions/transactionService");

describe("servicios de la API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loginAPI devuelve token y usuario juntos", async () => {
    post.mockResolvedValue({
      data: { token: "abc", user: { id: "1", username: "pastor" } },
    });

    const resultado = await loginAPI({
      email: "a@b.com",
      password: "Password123",
    });

    expect(resultado).toEqual({ token: "abc", user: { id: "1", username: "pastor" } });
  });

  it("changePasswordAPI envía la contraseña actual y la nueva", async () => {
    put.mockResolvedValue({ data: { message: "ok" } });

    await changePasswordAPI({
      currentPassword: "Vieja123",
      newPassword: "Nueva1234",
    });

    expect(put).toHaveBeenCalledWith("/users/change-password", {
      currentPassword: "Vieja123",
      newPassword: "Nueva1234",
    });
  });

  //! El servicio copia campo por campo, así que uno nuevo se pierde callado
  //! si no se añade en los dos sitios: el gasto llegaba sin su ministerio.
  it("registrar y editar un gasto llevan el fondo, el aportante y el ministerio", async () => {
    post.mockResolvedValue({ data: [{ _id: "t1" }] });
    await addTransactionAPI({
      type: "expense",
      category: "mantenimiento",
      amount: 200,
      date: "2026-09-20T12:00:00.000Z",
      description: "Biblias",
      fund: "f-misiones",
      donor: null,
      ministry: "m-misiones",
    });
    expect(post.mock.calls[0][1]).toMatchObject({
      fund: "f-misiones",
      donor: null,
      ministry: "m-misiones",
    });

    put.mockResolvedValue({ data: { _id: "t1" } });
    await updateTransactionAPI({ id: "t1", type: "expense", ministry: null });
    expect(put.mock.calls[0][1]).toHaveProperty("ministry", null);
  });

  it("getTransactionByPeriodAPI reenvía el filtro de categoría", async () => {
    get.mockResolvedValue({ data: [] });

    await getTransactionByPeriodAPI({
      period: "monthly",
      category: "diezmos",
      type: "income",
      startDate: "",
      endDate: "",
    });

    expect(get).toHaveBeenCalledWith("/transactions/period", {
      params: {
        period: "monthly",
        type: "income",
        category: "diezmos",
        startDate: "",
        endDate: "",
      },
    });
  });

  it("exportTransactionExcelAPI pide un blob con los filtros y dispara la descarga", async () => {
    get.mockResolvedValue({ data: new Blob(["contenido"]) });

    //! jsdom no implementa createObjectURL
    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const nombre = await exportTransactionExcelAPI({
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      type: "income",
      category: "diezmos",
    });

    expect(get).toHaveBeenCalledWith("/transactions/export/excel", {
      params: {
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        type: "income",
        category: "diezmos",
      },
      responseType: "blob",
    });
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    expect(nombre).toMatch(/^transacciones_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
