import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { getHealthUrl, wakeApi } from "../lib/wakeApi";
import { useEsperaLarga } from "../hooks/useEsperaLarga";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("despertar la API", () => {
  it("deriva la URL del health check desde la URL base", () => {
    //! En pruebas BASE_URL es http://localhost:8000/api/v1
    expect(getHealthUrl()).toBe("http://localhost:8000/health");
  });

  it("lanza la petición sin romper si falla", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("sin red"));

    expect(() => wakeApi()).not.toThrow();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/health",
      expect.objectContaining({ method: "GET" })
    );
  });
});

describe("useEsperaLarga", () => {
  it("avisa solo cuando la espera supera el umbral", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(({ activa }) => useEsperaLarga(activa, 4000), {
      initialProps: { activa: true },
    });

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(result.current).toBe(true);

    //! Al terminar la operación el aviso desaparece
    rerender({ activa: false });
    expect(result.current).toBe(false);
  });

  it("no avisa si la operación termina rápido", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(({ activa }) => useEsperaLarga(activa, 4000), {
      initialProps: { activa: true },
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender({ activa: false });

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(false);
  });
});
