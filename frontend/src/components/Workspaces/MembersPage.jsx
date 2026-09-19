import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvitationAPI,
  listInvitationsAPI,
  listMembersAPI,
  removeMemberAPI,
  revokeInvitationAPI,
  updateMemberRoleAPI,
} from "../../services/workspaces/workspaceService";
import { useWorkspace, WORKSPACES_KEY } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import {
  ROLE_HELP,
  ROLE_LABELS,
  assignableRoles,
  canManageMember,
} from "../../lib/roles";
import AlertMessage from "../Alert/AlertMessage";

//! Enlace de la invitación recién creada, con las formas de compartirlo
const InvitationLink = ({ invitation, workspaceName, onClose }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invitation.url);
      setCopied(true);
    } catch {
      //! Sin permiso de portapapeles: el enlace sigue visible para copiarlo a mano
    }
  };

  const whatsappText = `Te invito a llevar las cuentas de "${workspaceName}". Entra aquí para unirte: ${invitation.url}`;

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
      <p className="text-sm text-green-900">
        {invitation.emailSent
          ? `Enviamos la invitación a ${invitation.email}. También puedes compartir el enlace:`
          : `No se pudo enviar el correo a ${invitation.email}. Comparte este enlace con esa persona:`}
      </p>
      <input
        readOnly
        value={invitation.url}
        onFocus={(e) => e.target.select()}
        aria-label="Enlace de la invitación"
        className="w-full p-2 text-sm rounded-md border border-green-300 bg-white"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="px-3 py-1.5 text-sm rounded-md bg-white border border-green-300 hover:bg-green-100"
        >
          {copied ? "¡Copiado!" : "Copiar enlace"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white hover:bg-green-700"
        >
          Enviar por WhatsApp
        </a>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded-md text-gray-600 hover:underline"
        >
          Cerrar
        </button>
      </div>
      <p className="text-xs text-green-800">
        Solo funciona para {invitation.email} y caduca en 7 días.
      </p>
    </div>
  );
};

const MembersPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { workspace, can } = useWorkspace();
  const id = workspace?._id;
  const myRole = workspace?.role;
  const canManage = can("members:manage");

  const [invite, setInvite] = useState({ email: "", role: "contador" });
  const [lastInvitation, setLastInvitation] = useState(null);

  const membersQuery = useQuery({
    queryKey: ["members", id],
    queryFn: () => listMembersAPI(id),
    enabled: Boolean(id),
  });

  const invitationsQuery = useQuery({
    queryKey: ["invitations", id],
    queryFn: () => listInvitationsAPI(id),
    enabled: Boolean(id && canManage),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["members", id] });
    queryClient.invalidateQueries({ queryKey: ["invitations", id] });
  };

  const inviteMutation = useMutation({
    mutationFn: createInvitationAPI,
    onSuccess: (data) => {
      setLastInvitation(data);
      setInvite({ email: "", role: invite.role });
      refresh();
    },
  });
  const roleMutation = useMutation({ mutationFn: updateMemberRoleAPI, onSuccess: refresh });
  const removeMutation = useMutation({ mutationFn: removeMemberAPI });
  const revokeMutation = useMutation({ mutationFn: revokeInvitationAPI, onSuccess: refresh });

  const mutationError = [inviteMutation, roleMutation, removeMutation, revokeMutation].find(
    (m) => m.isError
  );

  if (!workspace) return <AlertMessage type="loading" message="Cargando espacio..." />;

  const handleInvite = (e) => {
    e.preventDefault();
    inviteMutation.mutate({ id, email: invite.email.trim(), role: invite.role });
  };

  const handleRemove = async (member) => {
    const text = member.isMe
      ? `¿Salir de "${workspace.name}"? Dejarás de ver sus cuentas.`
      : `¿Quitar a ${member.username} de "${workspace.name}"?`;
    if (!window.confirm(text)) return;

    try {
      await removeMutation.mutateAsync({ id, userId: member.userId });
    } catch {
      return; // el mensaje se muestra arriba
    }

    if (member.isMe) {
      //! Ya no se pertenece: se vuelve al espacio predeterminado
      await queryClient.invalidateQueries({ queryKey: WORKSPACES_KEY });
      navigate("/espacios");
    } else {
      refresh();
    }
  };

  const members = membersQuery.data || [];
  const invitations = invitationsQuery.data || [];
  const roles = assignableRoles(myRole);
  //! El último propietario no puede irse (el backend responde 409): no se le
  //! ofrece el botón en vez de dejarle chocar con el error
  const ownerCount = members.filter((m) => m.role === "propietario").length;
  const canLeave = (m) => !(m.role === "propietario" && ownerCount <= 1);

  return (
    <div className="max-w-3xl mx-auto my-8 px-2 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Miembros</h1>
        <p className="text-sm text-gray-500">{workspace.name}</p>
      </div>

      {mutationError && (
        <AlertMessage type="error" message={getErrorMessage(mutationError.error)} />
      )}

      {canManage && (
        <section className="bg-white p-5 rounded-lg shadow border border-gray-200 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Invitar a alguien</h2>

          {lastInvitation ? (
            <InvitationLink
              invitation={lastInvitation}
              workspaceName={workspace.name}
              onClose={() => setLastInvitation(null)}
            />
          ) : (
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="invite-email" className="text-sm text-gray-700">
                    Correo
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    required
                    value={invite.email}
                    onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                    placeholder="tesorera@correo.com"
                    className="p-2 rounded-md border border-gray-300"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="invite-role" className="text-sm text-gray-700">
                    Rol
                  </label>
                  <select
                    id="invite-role"
                    value={invite.role}
                    onChange={(e) => setInvite({ ...invite, role: e.target.value })}
                    className="p-2 rounded-md border border-gray-300"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-500">{ROLE_HELP[invite.role]}</p>
              <button
                type="submit"
                disabled={inviteMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-60"
              >
                {inviteMutation.isPending ? "Invitando..." : "Crear invitación"}
              </button>
            </form>
          )}
        </section>
      )}

      <section className="bg-white p-5 rounded-lg shadow border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Personas con acceso ({members.length})
        </h2>
        {membersQuery.isLoading && <AlertMessage type="loading" message="Cargando..." />}
        {membersQuery.isError && (
          <AlertMessage type="error" message={getErrorMessage(membersQuery.error)} />
        )}
        <ul className="divide-y divide-gray-100">
          {members.map((m) => {
            const manageable = !m.isMe && canManage && canManageMember(myRole, m.role);
            return (
              <li key={m.userId} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800">
                    {m.username} {m.isMe && <span className="text-gray-400">(tú)</span>}
                  </p>
                  {m.email && <p className="text-sm text-gray-500 truncate">{m.email}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {manageable ? (
                    <select
                      aria-label={`Rol de ${m.username}`}
                      value={m.role}
                      onChange={(e) =>
                        roleMutation.mutate({ id, userId: m.userId, role: e.target.value })
                      }
                      className="p-1.5 text-sm rounded-md border border-gray-300"
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {ROLE_LABELS[m.role]}
                    </span>
                  )}
                  {(manageable || (m.isMe && canLeave(m))) && (
                    <button
                      type="button"
                      onClick={() => handleRemove(m)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      {m.isMe ? "Salir" : "Quitar"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {canManage && invitations.length > 0 && (
        <section className="bg-white p-5 rounded-lg shadow border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Invitaciones pendientes</h2>
          <ul className="divide-y divide-gray-100">
            {invitations.map((inv) => (
              <li key={inv._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-gray-800 truncate">{inv.email}</p>
                  <p className="text-xs text-gray-500">
                    {ROLE_LABELS[inv.role]} · invitó {inv.invitedBy} · caduca el{" "}
                    {new Date(inv.expiresAt).toLocaleDateString("es")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revokeMutation.mutate({ id, invitationId: inv._id })}
                  className="text-sm text-red-600 hover:underline"
                >
                  Revocar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default MembersPage;
