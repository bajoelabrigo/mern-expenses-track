import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
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
    <div className="max-w-md mx-auto my-10 bg-white p-6 rounded-lg shadow border border-gray-200 space-y-4">
      <h1 className="text-2xl font-semibold text-gray-800 text-center">Invitación</h1>

      {preview.isLoading && <AlertMessage type="loading" message="Cargando invitación..." />}
      {preview.isError && (
        <AlertMessage type="error" message={getErrorMessage(preview.error)} />
      )}

      {invitation && (
        <>
          <p className="text-gray-700 text-center">
            <strong>{invitation.invitedBy}</strong> te invitó a{" "}
            <strong>
              {invitation.workspaceKind === "iglesia" ? "⛪" : "👤"} {invitation.workspaceName}
            </strong>{" "}
            como <strong>{ROLE_LABELS[invitation.role]}</strong>.
          </p>
          <p className="text-sm text-gray-500 text-center">{ROLE_HELP[invitation.role]}</p>

          {accept.isError && (
            <AlertMessage type="error" message={getErrorMessage(accept.error)} />
          )}

          {user ? (
            <>
              {user.email !== invitation.email && (
                <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-md">
                  La invitación es para <strong>{invitation.email}</strong> y entraste
                  como {user.email}. Cierra sesión y entra con esa cuenta.
                </p>
              )}
              <button
                type="button"
                onClick={() => accept.mutate()}
                disabled={accept.isPending || user.email !== invitation.email}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md disabled:opacity-50"
              >
                {accept.isPending ? "Uniéndote..." : "Aceptar y unirme"}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center">
                Para aceptar, entra o crea una cuenta con <strong>{invitation.email}</strong>.
              </p>
              <Link
                to="/login"
                state={{ ...volverAqui, email: invitation.email }}
                className="block text-center w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md"
              >
                Ya tengo cuenta: entrar
              </Link>
              <Link
                to="/register"
                state={{ ...volverAqui, email: invitation.email, invited: true }}
                className="block text-center w-full border border-gray-300 hover:bg-gray-50 py-2 rounded-md"
              >
                Crear una cuenta
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AcceptInvitation;
