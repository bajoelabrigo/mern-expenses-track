import { describe, it, expect } from "vitest";
import {
  getStoredAuth,
  setStoredAuth,
  clearStoredAuth,
  clearStoredData,
  getStoredToken,
  isTokenExpired,
} from "../utils/storage";

//! Genera un JWT falso (solo el payload importa para estas pruebas)
const fakeToken = (exp) => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ id: "123", exp }));
  return `${header}.${payload}.firma`;
};

const enUnaHora = Math.floor(Date.now() / 1000) + 3600;
const hace10Minutos = Math.floor(Date.now() / 1000) - 600;

describe("almacenamiento de la sesión", () => {
  it("guarda y recupera token y usuario", () => {
    const auth = {
      token: fakeToken(enUnaHora),
      user: { id: "123", username: "pastor", role: "user" },
    };
    setStoredAuth(auth);

    expect(getStoredAuth()).toEqual(auth);
    expect(getStoredToken()).toBe(auth.token);
  });

  it("descarta la sesión cuando el token ya expiró", () => {
    setStoredAuth({
      token: fakeToken(hace10Minutos),
      user: { id: "123", username: "pastor" },
    });

    expect(getStoredAuth()).toBeNull();
    expect(localStorage.getItem("userInfo")).toBeNull();
  });

  it("descarta datos guardados sin token (formato antiguo)", () => {
    //! Antes se guardaba solo el usuario, sin token
    localStorage.setItem(
      "userInfo",
      JSON.stringify({ id: "123", username: "pastor" })
    );

    expect(getStoredAuth()).toBeNull();
  });

  it("no revienta con un JSON corrupto", () => {
    localStorage.setItem("userInfo", "{no-es-json");

    expect(getStoredAuth()).toBeNull();
  });

  it("clearStoredAuth borra la sesión", () => {
    setStoredAuth({ token: fakeToken(enUnaHora), user: { id: "1" } });
    clearStoredAuth();

    expect(getStoredAuth()).toBeNull();
  });

  it("clearStoredData borra los datos de la API pero deja la sesión", () => {
    //! Es lo que hace "Recargar" cuando la app se rompe: si lo que quedó mal
    //! guardado es una respuesta, hay que tirarla, pero no echar a nadie.
    const auth = { token: fakeToken(enUnaHora), user: { id: "1", username: "pastor" } };
    setStoredAuth(auth);
    localStorage.setItem("cg-cache", JSON.stringify({ clientState: { queries: [] } }));

    clearStoredData();

    expect(localStorage.getItem("cg-cache")).toBeNull();
    expect(getStoredAuth()).toEqual(auth);
  });

  it("isTokenExpired reconoce tokens vencidos y vigentes", () => {
    expect(isTokenExpired(fakeToken(hace10Minutos))).toBe(true);
    expect(isTokenExpired(fakeToken(enUnaHora))).toBe(false);
    expect(isTokenExpired(null)).toBe(true);
  });
});
