import { useEffect, useState } from "react";

//! Tema claro / oscuro / según el sistema. index.html aplica el tema antes de
//! pintar; esto lo mantiene al cambiar la preferencia o la del sistema.
const KEY = "cg-theme";
const COLORS = { light: "#ecebe6", dark: "#0e0e0e" };

export const getThemeMode = () => {
  try {
    return localStorage.getItem(KEY) || "system";
  } catch {
    return "system";
  }
};

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export const applyTheme = (mode) => {
  const dark = mode === "dark" || (mode === "system" && systemDark());
  const theme = dark ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLORS[theme]);
  return theme;
};

//! Mantiene el tema al día en toda la app, no solo donde esté el selector:
//! si el teléfono pasa a oscuro (o vuelve a claro) con la app abierta, o la
//! app se retoma después de ese cambio, se vuelve a aplicar. En el APK la
//! pestaña se reutiliza y sin esto el tema se quedaba como estaba al abrirla.
export const watchSystemTheme = () => {
  const apply = () => applyTheme(getThemeMode());
  apply();

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", apply);
  //! Al volver a la app: un cambio mientras estaba en segundo plano no avisa
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) apply();
  });
  window.addEventListener("pageshow", apply);
};

export const useTheme = () => {
  const [mode, setModeState] = useState(getThemeMode);

  useEffect(() => {
    applyTheme(mode);
    if (mode !== "system") return undefined;
    //! En "sistema", seguir al teléfono si cambia (p. ej. modo noche automático)
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = (next) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      //! Sin almacenamiento el tema dura lo que la sesión
    }
    setModeState(next);
  };

  return { mode, setMode };
};
