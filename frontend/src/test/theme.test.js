import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyTheme, getThemeMode, watchSystemTheme } from "../lib/theme";

//! matchMedia no existe en jsdom: se simula uno que se puede cambiar
const fakeMedia = () => {
  const listeners = new Set();
  const media = {
    matches: false,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  };
  window.matchMedia = () => media;
  return {
    setDark: (dark) => {
      media.matches = dark;
      listeners.forEach((fn) => fn());
    },
  };
};

const theme = () => document.documentElement.dataset.theme;

describe("tema claro / oscuro", () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="" />';
    document.documentElement.removeAttribute("data-theme");
  });

  it("sin preferencia guardada sigue al teléfono, también si cambia con la app abierta", () => {
    const sistema = fakeMedia();
    expect(getThemeMode()).toBe("system");

    watchSystemTheme();
    expect(theme()).toBe("light");

    sistema.setDark(true);
    expect(theme()).toBe("dark");
    //! La barra de Android también cambia
    expect(document.querySelector('meta[name="theme-color"]').content).toBe("#0e0e0e");

    sistema.setDark(false);
    expect(theme()).toBe("light");
  });

  it("al volver a la app se vuelve a mirar el tema del teléfono", () => {
    const sistema = fakeMedia();
    watchSystemTheme();

    //! Cambió mientras la app estaba en segundo plano (no llega el aviso)
    window.matchMedia().matches = true;
    expect(theme()).toBe("light");

    document.dispatchEvent(new Event("visibilitychange"));
    expect(theme()).toBe("dark");
    sistema.setDark(false);
  });

  it("si se eligió un tema a mano, el del teléfono no manda", () => {
    const sistema = fakeMedia();
    localStorage.setItem("cg-theme", "light");
    watchSystemTheme();

    sistema.setDark(true);
    expect(theme()).toBe("light");
    expect(applyTheme("dark")).toBe("dark");
  });
});
