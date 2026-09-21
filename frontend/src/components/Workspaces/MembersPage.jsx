import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuCheck, LuCopy, LuMessageCircle } from "react-icons/lu";
import {
  addMemberAPI,
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
import { Button, Card, Chip, Field, Input, ListGroup, Notice, PageHeader } from "../ui";
import { initials } from "../ui/styles";

const SectionTitle = ({ children }) => (
  <h2 className="text-sm font-bold text-muted px-1 mb-2">{children}</h2>
);

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
    <div className="space-y-3">
      <Notice tone={invitation.emailSent ? "success" : "warning"}>
        {invitation.emailSent
          ? `Enviamos la invitación a ${invitation.email} para "${workspaceName}". También puedes compartir el enlace.`
          : `No se pudo enviar el correo a ${invitation.email}. Comparte este enlace con esa persona.`}
      </Notice>
      <Input
        readOnly
        value={invitation.url}
        onFocus={(e) => e.target.select()}
        aria-label="Enlace de la invitación"
        className="text-sm text-ink-2"
      />
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-full font-semibold text-[15px] bg-income text-white hover:opacity-90 transition"
        >
          <LuMessageCircle aria-hidden="true" /> Enviar por WhatsApp
        </a>
        <Button variant="secondary" onClick={copy}>
          {copied ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar enlace"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Listo
        </Button>
      </div>
      <p className="text-xs text-muted">
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

  const [form, setForm] = useState({ email: "", role: "contador" });
  const [lastInvitation, setLastInvitation] = useState(null);
  //! Miembro agregado hace un momento, y correo que todavía no tiene cuenta
  const [added, setAdded] = useState(null);
  const [sinCuenta, setSinCuenta] = useState(null);

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

  //! Alta directa: si la persona ya tiene cuenta entra al instante, sin
  //! invitación. Si el correo no está registrado (USER_NOT_FOUND) se ofrece
  //! mandarle una invitación, que es lo único que puede hacer que se registre.
  const addMutation = useMutation({
    mutationFn: addMemberAPI,
    onSuccess: (data, variables) => {
      setAdded(data);
      setSinCuenta(null);
      setForm({ email: "", role: variables.role });
      refresh();
    },
    onError: (error) => {
      const data = error?.response?.data;
      if (error?.response?.status === 404 && data?.code === "USER_NOT_FOUND") {
        setSinCuenta(form.email.trim());
      }
    },
  });

  const inviteMutation = useMutation({
    mutationFn: createInvitationAPI,
    onSuccess: (data, variables) => {
      setLastInvitation(data);
      setAdded(null);
      setSinCuenta(null);
      setForm({ email: "", role: variables.role });
      refresh();
    },
  });
  const roleMutation = useMutation({ mutationFn: updateMemberRoleAPI, onSuccess: refresh });
  const removeMutation = useMutation({ mutationFn: removeMemberAPI });
  const revokeMutation = useMutation({ mutationFn: revokeInvitationAPI, onSuccess: refresh });

  //! El "no tiene cuenta" no es un fallo: se explica en su propio aviso, con la
  //! salida (invitarle), así que no se pinta además como error.
  const mutationError = [
    addMutation,
    inviteMutation,
    roleMutation,
    removeMutation,
    revokeMutation,
  ].find((m) => m.isError && m.error?.response?.data?.code !== "USER_NOT_FOUND");

  if (!workspace) return <AlertMessage type="loading" message="Cargando espacio..." />;

  const handleAdd = (e) => {
    e.preventDefault();
    const email = form.email.trim();
    if (!email) return;
    setAdded(null);
    setSinCuenta(null);
    addMutation.mutate({ id, email, role: form.role });
  };

  const handleInvite = () => {
    inviteMutation.mutate({ id, email: (sinCuenta || form.email).trim(), role: form.role });
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
  const roles = assignableRoles(myRole, workspace.kind);
  //! El último propietario no puede irse (el backend responde 409): no se le
  //! ofrece el botón en vez de dejarle chocar con el error
  const ownerCount = members.filter((m) => m.role === "propietario").length;
  const canLeave = (m) => !(m.role === "propietario" && ownerCount <= 1);

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Miembros" subtitle={`Quién lleva las cuentas de ${workspace.name}.`} />
      <div className="space-y-6">
        {mutationError && (
          <AlertMessage type="error" message={getErrorMessage(mutationError.error)} />
        )}

        {canManage && (
          <section aria-labelledby="agregar">
            <SectionTitle>
              <span id="agregar">Agregar a alguien</span>
            </SectionTitle>
            <Card className="p-5">
              {lastInvitation ? (
                <InvitationLink
                  invitation={lastInvitation}
                  workspaceName={workspace.name}
                  onClose={() => setLastInvitation(null)}
                />
              ) : (
                <form onSubmit={handleAdd} className="space-y-4">
                  {added && (
                    <Notice tone="success">
                      {added.message}.
                      {added.emailSent
                        ? " Le enviamos un aviso por correo."
                        : " No se pudo enviar el aviso por correo: avísale por otro medio."}
                    </Notice>
                  )}
                  <Field
                    label="Correo"
                    htmlFor="invite-email"
                    hint="El correo con el que esa persona se registró en la app."
                  >
                    <Input
                      id="invite-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => {
                        setForm({ ...form, email: e.target.value });
                        setAdded(null);
                        setSinCuenta(null);
                      }}
                      placeholder="tesorera@correo.com"
                    />
                  </Field>
                  <fieldset>
                    <legend className="text-sm font-semibold text-ink-2 mb-2">Rol</legend>
                    <div className="flex flex-wrap gap-2">
                      {roles.map((r) => (
                        <Chip
                          key={r}
                          selected={form.role === r}
                          onClick={() => setForm({ ...form, role: r })}
                          className={form.role === r ? "" : "shadow-none bg-surface-2"}
                        >
                          {ROLE_LABELS[r]}
                        </Chip>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-muted">{ROLE_HELP[form.role]}.</p>
                  </fieldset>
                  <Button type="submit" block disabled={addMutation.isPending}>
                    {addMutation.isPending ? "Agregando…" : "Agregar"}
                  </Button>
                  <p className="text-xs text-muted">
                    Si ya tiene cuenta, entra al instante: no hace falta que confirme ningún
                    correo. Si todavía no la tiene, te ofreceremos enviarle una invitación.
                  </p>
                  {sinCuenta && (
                    <Notice tone="warning">
                      <p>
                        <strong className="text-ink">{sinCuenta}</strong> todavía no tiene cuenta
                        en la app. Invítale para que se registre con ese mismo correo.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={handleInvite}
                        disabled={inviteMutation.isPending}
                      >
                        {inviteMutation.isPending ? "Enviando…" : "Enviar invitación"}
                      </Button>
                    </Notice>
                  )}
                </form>
              )}
            </Card>
          </section>
        )}

        <section aria-labelledby="con-acceso">
          <SectionTitle>
            <span id="con-acceso">Personas con acceso · {members.length}</span>
          </SectionTitle>
          {membersQuery.isLoading && <AlertMessage type="loading" message="Cargando…" />}
          {membersQuery.isError && (
            <AlertMessage type="error" message={getErrorMessage(membersQuery.error)} />
          )}
          {members.length > 0 && (
            <ListGroup>
              {members.map((m) => {
                const manageable = !m.isMe && canManage && canManageMember(myRole, m.role);
                return (
                  <div key={m.userId} className="px-4 py-3 flex flex-wrap items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="h-11 w-11 shrink-0 rounded-full bg-surface-2 grid place-items-center text-sm font-bold text-ink-2"
                    >
                      {initials(m.username)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink truncate">
                        {m.username} {m.isMe && <span className="font-normal text-muted">(tú)</span>}
                      </p>
                      {m.email && <p className="text-sm text-muted truncate">{m.email}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      {manageable ? (
                        <select
                          aria-label={`Rol de ${m.username}`}
                          value={m.role}
                          onChange={(e) =>
                            roleMutation.mutate({ id, userId: m.userId, role: e.target.value })
                          }
                          className="h-9 pl-3 pr-2 text-sm font-semibold rounded-full bg-surface-2 text-ink border-0 focus:outline-none focus:ring-2 focus:ring-ink"
                        >
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-surface-2 text-ink-2">
                          {ROLE_LABELS[m.role]}
                        </span>
                      )}
                      {(manageable || (m.isMe && canLeave(m))) && (
                        <Button variant="danger-ghost" size="sm" onClick={() => handleRemove(m)}>
                          {m.isMe ? "Salir" : "Quitar"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </ListGroup>
          )}
        </section>

        {canManage && invitations.length > 0 && (
          <section aria-labelledby="pendientes">
            <SectionTitle>
              <span id="pendientes">Invitaciones pendientes · {invitations.length}</span>
            </SectionTitle>
            <ListGroup>
              {invitations.map((inv) => (
                <div key={inv._id} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink truncate">{inv.email}</p>
                    <p className="text-sm text-muted">
                      {ROLE_LABELS[inv.role]}, invitó {inv.invitedBy}. Caduca el{" "}
                      {new Date(inv.expiresAt).toLocaleDateString("es", { day: "numeric", month: "short" })}.
                    </p>
                  </div>
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    onClick={() => revokeMutation.mutate({ id, invitationId: inv._id })}
                  >
                    Revocar
                  </Button>
                </div>
              ))}
            </ListGroup>
          </section>
        )}
      </div>
    </div>
  );
};

export default MembersPage;
