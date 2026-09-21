import { axiosInstance } from "../../lib/axios";

//! Mis espacios, con mi rol y permisos en cada uno
export const listWorkspacesAPI = async () => {
  const response = await axiosInstance.get("/workspaces");
  return response.data;
};

//! Un espacio concreto (lo usa el admin de la plataforma para entrar como soporte)
export const getWorkspaceAPI = async (id) => {
  const response = await axiosInstance.get(`/workspaces/${id}`);
  return response.data;
};

export const createWorkspaceAPI = async ({ name, kind, currency }) => {
  const response = await axiosInstance.post("/workspaces", { name, kind, currency });
  return response.data;
};

export const updateWorkspaceAPI = async ({ id, name, currency }) => {
  const response = await axiosInstance.put(`/workspaces/${id}`, { name, currency });
  return response.data;
};

//! Borrado definitivo: exige escribir el nombre exacto
//! Logo del espacio: el que sale impreso en informes y constancias
export const setWorkspaceLogoAPI = async ({ id, file }) => {
  const form = new FormData();
  form.append("logo", file);
  const response = await axiosInstance.put(`/workspaces/${id}/logo`, form);
  return response.data;
};

export const removeWorkspaceLogoAPI = async (id) => {
  const response = await axiosInstance.delete(`/workspaces/${id}/logo`);
  return response.data;
};

export const deleteWorkspaceAPI = async ({ id, confirmName }) => {
  const response = await axiosInstance.delete(`/workspaces/${id}`, {
    data: { confirmName },
  });
  return response.data;
};

export const setDefaultWorkspaceAPI = async (workspaceId) => {
  const response = await axiosInstance.put("/users/default-workspace", { workspaceId });
  return response.data;
};

export const listMembersAPI = async (id) => {
  const response = await axiosInstance.get(`/workspaces/${id}/members`);
  return response.data;
};

//! Alta directa de alguien que ya tiene cuenta: entra al instante, sin
//! invitación ni correo que confirmar. Si el correo no está registrado, el
//! backend responde 404 con code USER_NOT_FOUND.
export const addMemberAPI = async ({ id, email, role }) => {
  const response = await axiosInstance.post(`/workspaces/${id}/members`, { email, role });
  return response.data;
};

export const updateMemberRoleAPI = async ({ id, userId, role }) => {
  const response = await axiosInstance.put(`/workspaces/${id}/members/${userId}`, { role });
  return response.data;
};

//! Quitar a un miembro, o salir uno mismo (userId = el propio)
export const removeMemberAPI = async ({ id, userId }) => {
  const response = await axiosInstance.delete(`/workspaces/${id}/members/${userId}`);
  return response.data;
};

export const listInvitationsAPI = async (id) => {
  const response = await axiosInstance.get(`/workspaces/${id}/invitations`);
  return response.data;
};

//! Devuelve { url, emailSent, ... }: el enlace se puede compartir a mano
export const createInvitationAPI = async ({ id, email, role }) => {
  const response = await axiosInstance.post(`/workspaces/${id}/invitations`, {
    email,
    role,
  });
  return response.data;
};

export const revokeInvitationAPI = async ({ id, invitationId }) => {
  const response = await axiosInstance.delete(
    `/workspaces/${id}/invitations/${invitationId}`
  );
  return response.data;
};

export const listAuditAPI = async ({ id, page = 1, limit = 30, entityId }) => {
  const response = await axiosInstance.get(`/workspaces/${id}/audit`, {
    params: { page, limit, entityId },
  });
  return response.data;
};

//! Invitación por token (la vista previa no exige sesión)
export const previewInvitationAPI = async (token) => {
  const response = await axiosInstance.get(`/invitations/${token}`);
  return response.data;
};

export const acceptInvitationAPI = async (token) => {
  const response = await axiosInstance.post(`/invitations/${token}/accept`);
  return response.data;
};
