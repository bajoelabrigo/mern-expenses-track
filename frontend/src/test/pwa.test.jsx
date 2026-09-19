import { describe, it, expect, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OfflineBanner from "../components/common/OfflineBanner";
import { shouldPersistQuery } from "../lib/queryClient";
import { clearStoredAuth, setStoredAuth } from "../utils/storage";

const setOnline = (value) => {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
};

describe("sin conexión", () => {
  afterEach(() => setOnline(true));

  const renderBanner = (client = new QueryClient()) =>
    render(
      <QueryClientProvider client={client}>
        <OfflineBanner />
      </QueryClientProvider>
    );

  it("muestra el aviso al perder la conexión y lo quita al recuperarla", () => {
    setOnline(true);
    renderBanner();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => setOnline(false));
    expect(screen.getByRole("status")).toHaveTextContent(/Sin conexión/);

    act(() => setOnline(true));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("avisa si hay red pero el servidor no responde, y se quita con la primera respuesta", async () => {
    setOnline(true);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderBanner(client);

    //! Error de red: sin "response"
    await act(() =>
      client
        .fetchQuery({ queryKey: ["x"], queryFn: () => Promise.reject(new Error("Network Error")) })
        .catch(() => {})
    );
    expect(screen.getByRole("status")).toHaveTextContent(/No se pudo conectar con el servidor/);

    //! Un 404 es una respuesta del servidor: no cuenta como caída
    await act(() =>
      client
        .fetchQuery({
          queryKey: ["y"],
          queryFn: () => Promise.reject(Object.assign(new Error("404"), { response: { status: 404 } })),
        })
        .catch(() => {})
    );
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(() => client.fetchQuery({ queryKey: ["z"], queryFn: async () => "ok" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("datos guardados en el dispositivo", () => {
  const query = (key, status) => ({ queryKey: [key], state: { status } });

  it("guarda solo las consultas correctas y nunca las del panel de admin", () => {
    expect(shouldPersistQuery(query("list-transactions", "success"))).toBe(true);
    expect(shouldPersistQuery(query("list-transactions", "error"))).toBe(false);
    expect(shouldPersistQuery(query("admin-users", "success"))).toBe(false);
  });

  it("borrar la sesión borra también los datos guardados", () => {
    setStoredAuth({ token: "t", user: { id: "1" } });
    localStorage.setItem("cg-cache", "{\"datos\":\"de otra cuenta\"}");

    clearStoredAuth();

    expect(localStorage.getItem("userInfo")).toBeNull();
    expect(localStorage.getItem("cg-cache")).toBeNull();
  });
});

describe("mensajes de error", () => {
  it("un error de red se explica en español en vez de 'Network Error'", async () => {
    const { getErrorMessage, NETWORK_ERROR_MESSAGE } = await import("../lib/axios");
    expect(getErrorMessage({ message: "Network Error", code: "ERR_NETWORK" })).toBe(
      NETWORK_ERROR_MESSAGE
    );
    //! El mensaje del servidor manda cuando lo hay
    expect(
      getErrorMessage({ message: "x", response: { data: { message: "Credenciales inválidas" } } })
    ).toBe("Credenciales inválidas");
  });
});
