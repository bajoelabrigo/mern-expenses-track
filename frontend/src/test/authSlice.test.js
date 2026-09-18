import { describe, it, expect } from "vitest";
import authReducer, {
  loginAction,
  logoutAction,
  updateUserAction,
} from "../redux/slice/authSlice";

const token = "cabecera.cGF5bG9hZA.firma";
const user = { id: "1", username: "pastor", role: "user", iglesia: "Central" };

describe("authSlice", () => {
  it("guarda token y usuario al iniciar sesión", () => {
    const estado = authReducer(
      { user: null, token: null },
      loginAction({ token, user })
    );

    expect(estado.user).toEqual(user);
    expect(estado.token).toBe(token);
    expect(JSON.parse(localStorage.getItem("userInfo"))).toEqual({
      token,
      user,
    });
  });

  it("limpia el estado y el almacenamiento al cerrar sesión", () => {
    const estado = authReducer({ user, token }, logoutAction());

    expect(estado.user).toBeNull();
    expect(estado.token).toBeNull();
    expect(localStorage.getItem("userInfo")).toBeNull();
  });

  it("actualiza el perfil sin perder el token", () => {
    const nuevo = { ...user, username: "pastor2" };
    const estado = authReducer({ user, token }, updateUserAction(nuevo));

    expect(estado.user.username).toBe("pastor2");
    expect(estado.token).toBe(token);
    expect(JSON.parse(localStorage.getItem("userInfo")).token).toBe(token);
  });
});
