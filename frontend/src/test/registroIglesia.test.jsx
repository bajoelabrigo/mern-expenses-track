import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RegistrationForm from "../components/Users/Register";
import { tokenDeInvitacion } from "../lib/invitationLink";

const churchExistsAPI = vi.fn();
vi.mock("../services/workspaces/workspaceService", () => ({
  churchExistsAPI: (...a) => churchExistsAPI(...a),
}));

vi.mock("../services/users/userService", () => ({
  registerAPI: vi.fn(),
}));

//! Página de invitación de mentira, para ver a dónde lleva el enlace pegado
const Invitacion = () => {
  const { token } = useParams();
  return <p>invitación {token}</p>;
};

const renderRegistro = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegistrationForm />} />
          <Route path="/invitacion/:token" element={<Invitacion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const escribirIglesia = async (nombre) => {
  const campo = await screen.findByLabelText("Nombre de la iglesia o ministerio");
  fireEvent.change(campo, { target: { value: nombre } });
  return campo;
};

describe("Registro: el nombre de la iglesia ya existe", () => {
  beforeEach(() => churchExistsAPI.mockReset());

  it("avisa y ofrece entrar por el enlace en vez de crear una gemela", async () => {
    churchExistsAPI.mockResolvedValue({ existe: true, cuantas: 1 });

    renderRegistro();
    await escribirIglesia("Ministerio Internacional Bajo el Abrigo del Altísimo");

    expect(
      await screen.findByText(/no crees otra/, {}, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(screen.getByText(/otro nombre para no confundirlas/)).toBeInTheDocument();

    //! Se pegó el enlace: se puede seguir por la invitación
    fireEvent.click(screen.getByRole("button", { name: /Ya me invitaron/ }));
    fireEvent.change(screen.getByLabelText("Enlace de invitación"), {
      target: { value: "https://controldegastosiglesia.netlify.app/invitacion/abcdef0123456789abcdef" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Continuar con la invitación" }));

    expect(await screen.findByText("invitación abcdef0123456789abcdef")).toBeInTheDocument();
  });

  it("si el nombre está libre no dice nada", async () => {
    churchExistsAPI.mockResolvedValue({ existe: false, cuantas: 0 });

    renderRegistro();
    await escribirIglesia("Iglesia Nueva de Prueba");

    await waitFor(() => expect(churchExistsAPI).toHaveBeenCalled());
    expect(screen.queryByText(/no crees otra/)).not.toBeInTheDocument();
  });

  it("con menos de 3 letras ni se pregunta", async () => {
    renderRegistro();
    await escribirIglesia("Ig");

    //! Se deja pasar el retraso de la comprobación sin salirse del act()
    await act(() => new Promise((r) => setTimeout(r, 700)));
    expect(churchExistsAPI).not.toHaveBeenCalled();
  });
});

describe("tokenDeInvitacion", () => {
  it("saca el token del enlace pegado", () => {
    const token = "0123456789abcdef0123456789abcdef";
    expect(tokenDeInvitacion(`https://x.test/invitacion/${token}`)).toBe(token);
    expect(tokenDeInvitacion(token)).toBe("");
    expect(tokenDeInvitacion("cualquier cosa")).toBe("");
  });
});
