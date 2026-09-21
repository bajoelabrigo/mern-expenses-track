import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { LuCheck, LuChevronRight, LuX } from "react-icons/lu";
import { listMembersAPI } from "../../services/workspaces/workspaceService";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useFunds } from "../../hooks/useFunds";
import { useDonors } from "../../hooks/useDonors";
import {
  buildSteps,
  finishGuide,
  guideProgress,
  hideGuide,
  isGuideHidden,
  isGuideRequested,
} from "../../lib/welcomeGuide";
import { Card } from "../ui";

//! "Primeros pasos" en el Inicio: qué le falta a este espacio para quedar
//! armado, con el atajo a cada pantalla. Se apaga sola cuando no queda ningún
//! paso, y también cuando la oculta quien la está viendo.
//!
//! `hasMovimientos` llega de afuera porque el Inicio ya pide los movimientos
//! recientes: la guía no hace una consulta de más. `null` = todavía no se sabe.
const WelcomeGuide = ({ hasMovimientos = null }) => {
  const user = useSelector((state) => state.auth.user);
  const { workspace, can } = useWorkspace();
  const { hasFunds, isLoading: cargandoFondos } = useFunds();
  const { donors, canSee: vePersonas, isLoading: cargandoPersonas } = useDonors();
  const [cerrada, setCerrada] = useState(false);

  const workspaceId = workspace?._id;
  const userId = user?.id || user?._id;

  //! Pedida desde el Perfil se muestra aunque ya esté terminada: es la única
  //! forma de volver a verla en un espacio que ya hizo los cuatro pasos.
  const pedida = isGuideRequested(workspaceId, userId);

  //! Solo para quien registra: a un lector o a un auditor no hay nada que
  //! pedirle, y ver pasos que no puede dar sería ruido.
  const activa = Boolean(
    workspaceId &&
      userId &&
      can("tx:write") &&
      !cerrada &&
      (pedida || !isGuideHidden(workspaceId, userId))
  );

  //! Si ya está oculta (o no es para esta persona) no se pregunta por los
  //! miembros: la guía no cuesta ni una consulta cuando no se ve
  const gestionaMiembros = activa && can("members:manage");
  const { data: miembros, isLoading: cargandoMiembros } = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => listMembersAPI(workspaceId),
    enabled: gestionaMiembros,
  });

  const steps = activa
    ? buildSteps({
        can,
        kind: workspace.kind,
        hasMovimientos,
        hasFunds,
        miembros: miembros?.length,
        personas: donors.length,
      })
    : [];
  const { hechos, total, listo } = guideProgress(steps);

  //! Mientras falte un dato la guía no se pinta: aparecer y corregirse un
  //! segundo después se lee como un error.
  const esperando =
    activa &&
    (hasMovimientos === null ||
      (gestionaMiembros && cargandoMiembros) ||
      (can("fund:manage") && cargandoFondos) ||
      (vePersonas && cargandoPersonas));

  useEffect(() => {
    //! Terminada no vuelve sola: queda apuntado en el dispositivo, y así la guía
    //! deja de consultar a los pocos segundos de haber hecho su trabajo. Si la
    //! pidieron a mano, se respeta y se queda hasta que la cierren.
    if (!activa || esperando || !listo || pedida) return;
    finishGuide(workspaceId, userId);
    setCerrada(true);
  }, [activa, esperando, listo, pedida, workspaceId, userId]);

  if (!activa || esperando || (listo && !pedida)) return null;

  const ocultar = () => {
    hideGuide(workspaceId, userId);
    setCerrada(true);
  };

  return (
    <Card as="section" aria-labelledby="primeros-pasos" className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="primeros-pasos" className="text-lg leading-tight font-extrabold text-ink">
            Primeros pasos
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {listo
              ? "Ya está todo listo. Puedes cerrarla cuando quieras."
              : `${hechos} de ${total} listos. En unos minutos el espacio queda armado.`}
          </p>
        </div>
        <button
          type="button"
          onClick={ocultar}
          aria-label="Ocultar la guía de primeros pasos"
          className="h-9 shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <LuX aria-hidden="true" /> Ocultar
        </button>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${(hechos / total) * 100}%` }}
        />
      </div>

      <ol className="mt-3 space-y-0.5">
        {steps.map((step, i) => (
          <li key={step.id}>
            {step.done ? (
              <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
                <span
                  aria-hidden="true"
                  className="h-7 w-7 shrink-0 grid place-items-center rounded-full bg-income-soft text-income"
                >
                  <LuCheck />
                </span>
                <span className="text-sm font-semibold text-muted line-through">{step.title}</span>
                <span className="sr-only">Listo</span>
              </div>
            ) : (
              <Link
                to={step.to}
                className="group flex items-start gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-surface-2"
              >
                <span
                  aria-hidden="true"
                  className="h-7 w-7 shrink-0 grid place-items-center rounded-full bg-surface-2 text-sm font-bold tabular text-ink-2"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{step.title}</span>
                  <span className="block text-xs text-muted">{step.hint}</span>
                </span>
                <LuChevronRight
                  aria-hidden="true"
                  className="mt-1.5 shrink-0 text-muted group-hover:text-ink"
                />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
};

export default WelcomeGuide;
