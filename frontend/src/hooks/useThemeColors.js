import { useEffect, useState } from "react";

//! Colores del tema leídos de las variables CSS, para los gráficos (Chart.js
//! pinta en un canvas y no entiende clases). Se actualizan al cambiar el tema.
const read = () => {
  const s = getComputedStyle(document.documentElement);
  const v = (name) => s.getPropertyValue(name).trim();
  return {
    ink: v("--ink"),
    muted: v("--muted"),
    line: v("--line"),
    surface: v("--surface"),
    accent: v("--accent"),
    income: v("--income"),
    expense: v("--expense"),
  };
};

export const useThemeColors = () => {
  const [colors, setColors] = useState(read);

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return colors;
};

export default useThemeColors;
