import { useEffect, useState } from "react";

//! Devuelve true cuando una operación lleva más de `ms` en curso.
//! Sirve para avisar de que el servidor gratuito está despertando en lugar de
//! dejar al usuario mirando un botón bloqueado sin explicación.
export const useEsperaLarga = (activa, ms = 4000) => {
  const [esLarga, setEsLarga] = useState(false);

  useEffect(() => {
    if (!activa) {
      setEsLarga(false);
      return undefined;
    }

    const timeout = setTimeout(() => setEsLarga(true), ms);
    return () => clearTimeout(timeout);
  }, [activa, ms]);

  return esLarga;
};

export default useEsperaLarga;
