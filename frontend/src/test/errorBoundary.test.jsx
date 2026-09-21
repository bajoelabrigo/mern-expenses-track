import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "../components/common/ErrorBoundary";

//! Un hijo que revienta al pintarse, como cuando la caché del navegador trae
//! algo que no es lo que la app espera.
const Explota = () => {
  throw new Error("boom");
};

const conUbicacionFalsa = (recargar) =>
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...window.location, reload: recargar },
  });

describe("Cuando la app se rompe", () => {
  const ubicacion = window.location;

  beforeEach(() => {
    //! React y el propio boundary escriben el error en consola: no ensuciar la salida
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: ubicacion,
    });
  });

  it("avisa y ofrece recargar, en vez de dejar la pantalla en blanco", () => {
    render(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>
    );

    expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recargar" })).toBeInTheDocument();
  });

  it("recargar tira los datos guardados, que pueden ser lo que se rompió", () => {
    const recargar = vi.fn();
    conUbicacionFalsa(recargar);

    localStorage.setItem("cg-cache", JSON.stringify({ clientState: { queries: [] } }));
    localStorage.setItem(
      "userInfo",
      JSON.stringify({ token: "de-prueba", user: { id: "1", username: "tesorera" } })
    );

    render(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole("button", { name: "Recargar" }));

    //! Los datos de la API se borran: si no, la recarga vuelve a fallar igual
    expect(localStorage.getItem("cg-cache")).toBeNull();
    //! Pero la sesión se queda: nadie tiene que volver a entrar por esto
    expect(localStorage.getItem("userInfo")).not.toBeNull();
    expect(recargar).toHaveBeenCalled();
  });

  it("cuando no hay error, deja pasar a los hijos", () => {
    render(
      <ErrorBoundary>
        <p>todo bien</p>
      </ErrorBoundary>
    );

    expect(screen.getByText("todo bien")).toBeInTheDocument();
    expect(screen.queryByText("Algo salió mal")).not.toBeInTheDocument();
  });
});
