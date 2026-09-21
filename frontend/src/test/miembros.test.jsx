import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "../redux/slice/authSlice";
import workspaceReducer from "../redux/slice/workspaceSlice";
import MembersPage from "../components/Workspaces/MembersPage";

const IGLESIA = {
  _id: "w-iglesia",
  name: "Iglesia Betel",
  kind: "iglesia",
  currency: "PEN",
  isDefault: true,
  role: "propietario",
  permissions: ["tx:read", "members:manage"],
};

const PASTOR = {
  userId: "u-pastor",
  username: "pastor",
  email: "pastor@test.com",
  role: "propietario",
  isMe: true,
};

const listWorkspacesAPI = vi.fn();
const listMembersAPI = vi.fn();
const listInvitationsAPI = vi.fn();
const addMemberAPI = vi.fn();
const createInvitationAPI = vi.fn();
const listJoinRequestsAPI = vi.fn();
const approveJoinRequestAPI = vi.fn();
const rejectJoinRequestAPI = vi.fn();

vi.mock("../services/workspaces/workspaceService", () => ({
  listWorkspacesAPI: (...a) => listWorkspacesAPI(...a),
  listMembersAPI: (...a) => listMembersAPI(...a),
  listInvitationsAPI: (...a) => listInvitationsAPI(...a),
  addMemberAPI: (...a) => addMemberAPI(...a),
  createInvitationAPI: (...a) => createInvitationAPI(...a),
  listJoinRequestsAPI: (...a) => listJoinRequestsAPI(...a),
  approveJoinRequestAPI: (...a) => approveJoinRequestAPI(...a),
  rejectJoinRequestAPI: (...a) => rejectJoinRequestAPI(...a),
  updateMemberRoleAPI: vi.fn(),
  removeMemberAPI: vi.fn(),
  revokeInvitationAPI: vi.fn(),
  getWorkspaceAPI: vi.fn(),
}));

//! Como responde el backend cuando el correo no está registrado
const sinCuenta = () => {
  const error = new Error("Request failed with status code 404");
  error.response = {
    status: 404,
    data: {
      message: "Esa persona todavía no tiene cuenta en la app. Envíale una invitación.",
      code: "USER_NOT_FOUND",
    },
  };
  return error;
};

const renderCon = (ui, ruta = "/") => {
  listWorkspacesAPI.mockResolvedValue([IGLESIA]);
  const store = configureStore({
    reducer: { auth: authReducer, workspace: workspaceReducer },
    preloadedState: {
      auth: { user: { id: "u-pastor", role: "user" }, token: "token" },
      workspace: { currentId: IGLESIA._id },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/" element={ui} />
            <Route path="/espacios" element={<p>elegir espacio</p>} />
            <Route path="/dashboard" element={<p>panel de usuario</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

//! Escribe el correo y pulsa Agregar
const agregar = async (email) => {
  fireEvent.change(await screen.findByLabelText("Correo"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
};

describe("Miembros: agregar a alguien que ya tiene cuenta", () => {
  beforeEach(() => {
    [
      listWorkspacesAPI,
      listMembersAPI,
      listInvitationsAPI,
      addMemberAPI,
      createInvitationAPI,
      listJoinRequestsAPI,
      approveJoinRequestAPI,
      rejectJoinRequestAPI,
    ].forEach((m) => m.mockReset());
    listMembersAPI.mockResolvedValue([PASTOR]);
    listInvitationsAPI.mockResolvedValue([]);
    listJoinRequestsAPI.mockResolvedValue([]);
  });

  it("lo agrega directo, con su rol, y avisa que ya tiene acceso", async () => {
    addMemberAPI.mockResolvedValue({
      message: 'ana ya tiene acceso a "Iglesia Betel" como Tesorero',
      emailSent: true,
      member: { userId: "u-ana", username: "ana", email: "ana@test.com", role: "tesorero" },
    });
    listMembersAPI
      .mockResolvedValueOnce([PASTOR])
      .mockResolvedValue([
        PASTOR,
        {
          userId: "u-ana",
          username: "ana",
          email: "ana@test.com",
          role: "tesorero",
          isMe: false,
        },
      ]);

    renderCon(<MembersPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Tesorero" }));
    await agregar("ana@test.com");

    //! Se agregó con el rol elegido, sin invitación de por medio
    await waitFor(() => expect(addMemberAPI).toHaveBeenCalled());
    expect(addMemberAPI.mock.calls[0][0]).toEqual({
      id: IGLESIA._id,
      email: "ana@test.com",
      role: "tesorero",
    });
    expect(createInvitationAPI).not.toHaveBeenCalled();

    //! Y se le dice al administrador que el aviso salió (no hay nada que confirmar)
    //! y, sobre todo, EN QUE ESPACIO quedó la persona
    expect(await screen.findByText(/ana ya tiene acceso a "Iglesia Betel" como Tesorero/)).toBeInTheDocument();
    expect(screen.getByText(/Le enviamos un aviso por correo/)).toBeInTheDocument();

    //! La lista se refresca con la persona nueva
    await waitFor(() => expect(listMembersAPI).toHaveBeenCalledTimes(2));
    expect(screen.getByText("ana")).toBeInTheDocument();
  });

  it("si el correo no tiene cuenta, lo explica y ofrece invitarle (sin mandar nada solo)", async () => {
    addMemberAPI.mockRejectedValue(sinCuenta());
    createInvitationAPI.mockResolvedValue({
      _id: "inv1",
      email: "nadie@test.com",
      role: "contador",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      url: "https://app.test/invitacion/token123",
      emailSent: true,
    });

    renderCon(<MembersPage />);
    await agregar("nadie@test.com");

    expect(await screen.findByText(/todavía no tiene cuenta en la app/)).toBeInTheDocument();
    //! Nada se envió por su cuenta, y no se pinta como un fallo genérico
    expect(createInvitationAPI).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Enviar invitación" }));

    await waitFor(() => expect(createInvitationAPI).toHaveBeenCalled());
    expect(createInvitationAPI.mock.calls[0][0]).toEqual({
      id: IGLESIA._id,
      email: "nadie@test.com",
      role: "contador",
    });
    //! Y queda el enlace para compartirlo a mano, como antes, diciendo para que
    //! espacio es
    expect(await screen.findByText(/Enviamos la invitación a nadie@test.com para "Iglesia Betel"/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://app.test/invitacion/token123")).toBeInTheDocument();
  });

  it("un fallo de verdad sí se muestra como error", async () => {
    const error = new Error("Request failed with status code 500");
    error.response = { status: 500, data: { message: "No se pudo agregar. Inténtalo de nuevo." } };
    addMemberAPI.mockRejectedValue(error);

    renderCon(<MembersPage />);
    await agregar("ana@test.com");

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo agregar. Inténtalo de nuevo.");
    //! El correo se queda escrito para poder reintentar sin volver a teclearlo
    expect(screen.getByLabelText("Correo")).toHaveValue("ana@test.com");
  });
});

describe("Miembros: solicitudes para entrar", () => {
  const SOLICITUD = {
    _id: "sol1",
    userId: "u-ana",
    username: "ana",
    email: "ana@test.com",
    message: "Soy la tesorera del ministerio",
    createdAt: "2026-09-21T10:00:00.000Z",
  };

  beforeEach(() => {
    [
      listWorkspacesAPI,
      listMembersAPI,
      listInvitationsAPI,
      listJoinRequestsAPI,
      approveJoinRequestAPI,
      rejectJoinRequestAPI,
    ].forEach((m) => m.mockReset());
    listMembersAPI.mockResolvedValue([PASTOR]);
    listInvitationsAPI.mockResolvedValue([]);
    listJoinRequestsAPI.mockResolvedValue([SOLICITUD]);
  });

  it("la tesorería ve quién pide entrar, con su mensaje, y lo aprueba con un rol", async () => {
    approveJoinRequestAPI.mockResolvedValue({ message: "ana ya tiene acceso", role: "contador" });

    renderCon(<MembersPage />);

    //! Quien pide entrar NO entra solo: hay que aprobarlo
    expect(await screen.findByText(/Solicitudes para entrar · 1/)).toBeInTheDocument();
    expect(screen.getByText(/Soy la tesorera del ministerio/)).toBeInTheDocument();

    //! Con el rol elegido (por defecto, el más prudente: lector)
    fireEvent.change(screen.getByLabelText("Entra como"), { target: { value: "contador" } });
    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));

    await waitFor(() => expect(approveJoinRequestAPI).toHaveBeenCalled());
    expect(approveJoinRequestAPI.mock.calls[0][0]).toEqual({
      id: IGLESIA._id,
      requestId: "sol1",
      role: "contador",
    });
  });

  it("se puede rechazar sin dar acceso", async () => {
    rejectJoinRequestAPI.mockResolvedValue({ message: "Solicitud rechazada" });

    renderCon(<MembersPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Rechazar" }));

    await waitFor(() => expect(rejectJoinRequestAPI).toHaveBeenCalled());
    expect(rejectJoinRequestAPI.mock.calls[0][0]).toEqual({ id: IGLESIA._id, requestId: "sol1" });
  });
});
