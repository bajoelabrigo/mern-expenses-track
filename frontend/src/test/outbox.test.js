import { describe, it, expect, vi } from "vitest";
import {
  addToOutbox,
  newClientId,
  readOutbox,
  subscribeOutbox,
  syncOutbox,
} from "../lib/outbox";

//! Errores con la forma de los de axios
const networkError = () => Object.assign(new Error("Network Error"), { isAxiosError: true });
const httpError = (status, message) =>
  Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data: { message } },
  });

const item = (id, userId = "u1", extra = {}) => ({
  id,
  userId,
  workspaceId: "w1",
  payload: { type: "expense", amount: 10, category: "luz", date: "2026-09-18" },
  ...extra,
});

describe("bandeja de salida", () => {
  it("genera identificadores válidos para el servidor", () => {
    const id = newClientId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(newClientId()).not.toBe(id);
  });

  it("envía en orden, borra lo enviado y avisa a quien escucha", async () => {
    addToOutbox(item("a1234567"));
    addToOutbox(item("b1234567"));
    const listener = vi.fn();
    const unsubscribe = subscribeOutbox(listener);
    const send = vi.fn().mockResolvedValue({});

    const sent = await syncOutbox({ userId: "u1", send });

    expect(sent).toBe(2);
    expect(send.mock.calls.map(([i]) => i.id)).toEqual(["a1234567", "b1234567"]);
    expect(readOutbox()).toEqual([]);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("sin red se detiene y no pierde nada", async () => {
    addToOutbox(item("a1234567"));
    addToOutbox(item("b1234567"));
    const send = vi.fn().mockRejectedValue(networkError());

    const sent = await syncOutbox({ userId: "u1", send });

    expect(sent).toBe(0);
    expect(send).toHaveBeenCalledTimes(1); //! no insiste con el resto
    expect(readOutbox().map((i) => i.status)).toEqual(["pending", "pending"]);
  });

  it("con la sesión caducada (401) se detiene y lo deja pendiente", async () => {
    addToOutbox(item("a1234567"));
    const send = vi.fn().mockRejectedValue(httpError(401, "Sesión inválida"));

    await syncOutbox({ userId: "u1", send });

    expect(readOutbox()[0].status).toBe("pending");
  });

  it("un rechazo del servidor lo marca como fallido con el motivo y sigue con el resto", async () => {
    addToOutbox(item("a1234567"));
    addToOutbox(item("b1234567"));
    const send = vi
      .fn()
      .mockRejectedValueOnce(httpError(403, "Tu rol en este espacio no permite esta acción"))
      .mockResolvedValueOnce({});

    const sent = await syncOutbox({ userId: "u1", send });

    expect(sent).toBe(1);
    const [fallido] = readOutbox();
    expect(fallido.id).toBe("a1234567");
    expect(fallido.status).toBe("failed");
    expect(fallido.error).toMatch(/no permite/);

    //! Un fallido no se reintenta solo
    send.mockClear();
    await syncOutbox({ userId: "u1", send });
    expect(send).not.toHaveBeenCalled();
  });

  it("solo envía lo del usuario con sesión", async () => {
    addToOutbox(item("a1234567", "u1"));
    addToOutbox(item("b1234567", "otra-persona"));
    const send = vi.fn().mockResolvedValue({});

    await syncOutbox({ userId: "u1", send });

    expect(send).toHaveBeenCalledTimes(1);
    expect(readOutbox().map((i) => i.userId)).toEqual(["otra-persona"]);
  });

  it("dos sincronizaciones a la vez no envían dos veces lo mismo", async () => {
    addToOutbox(item("a1234567"));
    let resolve;
    const send = vi.fn(() => new Promise((r) => (resolve = r)));

    const first = syncOutbox({ userId: "u1", send });
    const second = await syncOutbox({ userId: "u1", send });
    resolve({});
    await first;

    expect(second).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
