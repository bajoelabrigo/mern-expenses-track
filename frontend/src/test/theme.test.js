import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_MODE, applyTheme, getThemeMode, watchSystemTheme } from "../lib/theme";

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

  it("sin preferencia guardada la app abre en oscuro, aunque el teléfono esté en claro", () => {
    const sistema = fakeMedia();
    expect(getThemeMode()).toBe("dark");

    watchSystemTheme();
    expect(theme()).toBe("dark");
    //! La barra de Android también
    expect(document.querySelector('meta[name="theme-color"]').content).toBe("#0e0e0e");

    //! Y no se mueve porque el teléfono cambie: eso solo pasa en "Sistema"
    sistema.setDark(false);
    expect(theme()).toBe("dark");
  });

  it("el mismo valor por defecto que el script de index.html", () => {
    //! index.html pinta antes que la app: si los dos no dicen lo mismo, se ve
    //! un destello del tema equivocado al abrir
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    const guion = html.match(/localStorage\.getItem\("cg-theme"\) \|\| "(\w+)"/);
    expect(guion?.[1]).toBe(DEFAULT_MODE);
  });

  it("en \"Sistema\" sigue al teléfono, también si cambia con la app abierta", () => {
    const sistema = fakeMedia();
    localStorage.setItem("cg-theme", "system");

    watchSystemTheme();
    expect(theme()).toBe("light");

    sistema.setDark(true);
    expect(theme()).toBe("dark");

    sistema.setDark(false);
    expect(theme()).toBe("light");
  });

  it("al volver a la app se vuelve a mirar el tema del teléfono", () => {
    const sistema = fakeMedia();
    localStorage.setItem("cg-theme", "system");
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
