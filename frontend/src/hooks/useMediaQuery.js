import { useEffect, useState } from "react";

//! ¿Cumple la pantalla esta media query? Se actualiza al girar o redimensionar.
export const useMediaQuery = (query) => {
  const get = () => typeof window !== "undefined" && window.matchMedia?.(query).matches === true;
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
};

//! Pantallas grandes: el breakpoint `lg` de Tailwind
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");

export default useMediaQuery;
