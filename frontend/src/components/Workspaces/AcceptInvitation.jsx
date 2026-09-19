import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptInvitationAPI,
  previewInvitationAPI,
} from "../../services/workspaces/workspaceService";
import { useWorkspace, WORKSPACES_KEY } from "../../hooks/useWorkspace";
import { getErrorMessage } from "../../lib/axios";
import { ROLE_HELP, ROLE_LABELS } from "../../lib/roles";
import AlertMessage from "../Alert/AlertMessage";
import { Button, ButtonLink, Notice } from "../ui";
import AuthShell from "../Users/AuthShell";

//! /invitacion/:token — se abre desde el correo o el WhatsApp. Funciona sin
//! sesión: muestra a qué te invitan y te manda a entrar o registrarte.
const AcceptInvitation = () => {
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useSelector((state) => state.auth.user);
  const { switchWorkspace } = useWorkspace();

  const preview = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => previewInvitationAPI(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => acceptInvitationAPI(token),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: WORKSPACES_KEY });
      switchWorkspace(data.workspace._id);
      navigate("/dashboard", { replace: true });
    },
  });

  const invitation = preview.data;
  //! Tras entrar o registrarse se vuelve aquí para aceptar
  const volverAqui = { from: location.pathname };

  return (
    <AuthShell
      title="Te invitaron"
      subtitle={invitation ? `A llevar las cuentas de ${invitation.workspaceName}.` : undefined}
    >
      {preview.isLoading && <AlertMessage type="loading" message="Cargando invitación…" />}
      {preview.isError && <AlertMessage type="error" message={getErrorMessage(preview.error)} />}

      {invitation && (
        <>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-12 w-12 shrink-0 rounded-xl bg-surface-2 grid place-items-center text-2xl"
            >
              {invitation.workspaceKind === "iglesia" ? "⛪" : "👤"}
            </span>
            <div className="min-w-0">
              <p className="font-bold text-ink truncate">{invitation.workspaceName}</p>
              <p className="text-sm text-muted">Te invitó {invitation.invitedBy}</p>
            </div>
          </div>

          <div className="rounded-xl bg-surface-2 px-4 py-3">
            <p className="text-sm font-bold text-ink">{ROLE_LABELS[invitation.role]}</p>
            <p className="text-sm text-ink-2">{ROLE_HELP[invitation.role]}.</p>
          </div>

          {accept.isError && <AlertMessage type="error" message={getErrorMessage(accept.error)} />}

          {user ? (
            <>
              {user.email !== invitation.email && (
                <Notice tone="warning">
                  La invitación es para <strong>{invitation.email}</strong> y entraste como{" "}
                  {user.email}. Cierra sesión y entra con esa cuenta.
                </Notice>
              )}
              <Button
                block
                onClick={() => accept.mutate()}
                disabled={accept.isPending || user.email !== invitation.email}
              >
                {accept.isPending ? "Uniéndote…" : "Aceptar y unirme"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                Para aceptar, entra o crea una cuenta con <strong className="text-ink">{invitation.email}</strong>.
              </p>
              <ButtonLink to="/login" state={{ ...volverAqui, email: invitation.email }} block>
                Ya tengo cuenta: entrar
              </ButtonLink>
              <ButtonLink
                to="/register"
                state={{ ...volverAqui, email: invitation.email, invited: true }}
                variant="secondary"
                block
              >
                Crear una cuenta
              </ButtonLink>
            </>
          )}
        </>
      )}
    </AuthShell>
  );
};

export default AcceptInvitation;
