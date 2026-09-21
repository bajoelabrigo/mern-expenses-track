import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LuBellRing,
  LuCheckCheck,
  LuHandCoins,
  LuHandHeart,
  LuHeartHandshake,
  LuLink,
  LuPiggyBank,
  LuReceiptText,
  LuSettings,
  LuSmartphone,
  LuTags,
  LuUsers,
} from "react-icons/lu";
import { useAvisos } from "../../hooks/useAvisos";
import {
  pushStatusAPI,
  subscribePushAPI,
  testPushAPI,
  unsubscribePushAPI,
} from "../../services/notifications/notificationService";
import * as webpush from "../../lib/push";
import { getErrorMessage } from "../../lib/axios";
import { Button, Card, EmptyState, Notice, PageHeader } from "../ui";
import { cx } from "../ui/styles";

//! Un icono por tipo de cambio, para reconocer el aviso de un vistazo
const ICONOS = {
  transaction: LuReceiptText,
  category: LuTags,
  fund: LuPiggyBank,
  fundTransfer: LuPiggyBank,
  donor: LuHeartHandshake,
  member: LuUsers,
  invitation: LuUsers,
  ministry: LuHandHeart,
  offeringCount: LuHandCoins,
  publicLink: LuLink,
  workspace: LuSettings,
};

//! "hace 5 minutos", "ayer", "21 de septiembre". Lo reciente se cuenta en
//! unidades; lo viejo, con la fecha, que se entiende mejor que "hace 34 días".
const cuando = (fecha) => {
  const d = new Date(fecha);
  const minutos = Math.round((Date.now() - d.getTime()) / 60000);
  if (minutos < 1) return "ahora mismo";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  return d.toLocaleDateString("es", { day: "numeric", month: "long" });
};

const FILA =
  "flex items-start gap-3 px-4 py-3 transition hover:bg-surface-2";

//! ── Avisos al teléfono ──
//! Web Push: llegan con la app cerrada. Necesita que el servidor tenga las
//! claves (VAPID) y que la persona dé permiso en este aparato.
const PushCard = () => {
  const [estado, setEstado] = useState(null);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["avisos-push"],
    queryFn: pushStatusAPI,
  });

  //! ¿Está este aparato ya suscrito?
  useEffect(() => {
    let vivo = true;
    webpush.suscripcionActual().then((suscripcion) => {
      if (vivo) setEstado(suscripcion ? suscripcion.endpoint : null);
    });
    return () => {
      vivo = false;
    };
  }, [data]);

  const activar = useCallback(async () => {
    setError("");
    setAviso("");
    if (!data?.publicKey) {
      setError("El servidor todavía no tiene las claves para mandar avisos.");
      return;
    }
    setTrabajando(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setError("No diste permiso para mostrar avisos, así que no se activaron.");
        return;
      }
      const suscripcion = await webpush.suscribir(data.publicKey);
      await subscribePushAPI(suscripcion.toJSON());
      setEstado(suscripcion.endpoint);
      setAviso("Avisos activados en este aparato.");
      refetch();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTrabajando(false);
    }
  }, [data, refetch]);

  const apagar = useCallback(async () => {
    setError("");
    setAviso("");
    setTrabajando(true);
    try {
      const suscripcion = await webpush.quitar();
      if (suscripcion) await unsubscribePushAPI(suscripcion.endpoint);
      setEstado(null);
      setAviso("Avisos apagados en este aparato.");
      refetch();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTrabajando(false);
    }
  }, [refetch]);

  const probar = useCallback(async () => {
    setError("");
    setAviso("");
    setTrabajando(true);
    try {
      const r = await testPushAPI();
      setAviso(r.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTrabajando(false);
    }
  }, []);

  const activos = Boolean(estado);
  const enApp = webpush.esIOS() && !webpush.instalada();

  return (
    <Card as="section" aria-labelledby="avisos-telefono" className="p-5">
      <h2 id="avisos-telefono" className="font-extrabold inline-flex items-center gap-2">
        <LuSmartphone aria-hidden="true" /> Avisos en el teléfono
      </h2>
      <p className="mt-1 text-sm text-muted">
        Llegan aunque la app esté cerrada. Solo los recibe quien los active: cada aparato se apunta
        por su cuenta.
      </p>

      {!webpush.soportado() && (
        <Notice tone="warning" className="mt-4">
          Este navegador no sabe mostrar avisos de la app. Prueba con Chrome en Android o
          instalándola en el teléfono.
        </Notice>
      )}

      {enApp && (
        <Notice tone="warning" className="mt-4">
          En iPhone hay que instalar la app primero: comparte → «Añadir a pantalla de inicio», y
          actívalos desde ahí.
        </Notice>
      )}

      {webpush.soportado() && data?.disponible === false && (
        <Notice tone="warning" className="mt-4">
          El servidor todavía no tiene las claves para mandar avisos (VAPID). La campana de aquí
          arriba funciona igual: los avisos llegan cuando abras la app.
        </Notice>
      )}

      {webpush.soportado() && webpush.permiso() === "denied" && (
        <Notice tone="danger" className="mt-4">
          Bloqueaste los avisos para este sitio. Para activarlos hay que permitirlos en los ajustes
          del navegador.
        </Notice>
      )}

      {error && (
        <Notice tone="danger" className="mt-4">
          {error}
        </Notice>
      )}
      {aviso && (
        <Notice tone="success" className="mt-4">
          {aviso}
        </Notice>
      )}

      {webpush.soportado() && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {activos ? (
            <>
              <span className="text-sm font-semibold text-income">Activados en este aparato</span>
              <Button variant="secondary" size="sm" onClick={probar} disabled={trabajando}>
                <LuBellRing aria-hidden="true" /> Probar
              </Button>
              <Button variant="ghost" size="sm" onClick={apagar} disabled={trabajando}>
                Apagar
              </Button>
            </>
          ) : (
            <Button
              onClick={activar}
              disabled={
                trabajando || !data?.publicKey || webpush.permiso() === "denied"
              }
            >
              <LuBellRing aria-hidden="true" /> Activar en este aparato
            </Button>
          )}
        </div>
      )}

      {data?.aparatos?.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Apuntados ahora mismo: {data.aparatos.map((aparato) => aparato.nombre).join(", ")}.
        </p>
      )}
    </Card>
  );
};

//! ── La campana ──
const AvisosPage = () => {
  const { items, unread, isLoading, isError, error, marcarVistos } = useAvisos();

  //! Al abrir la pantalla se dan por vistos: el contador vuelve a cero y la
  //! lista sigue ahí para poder leerla con calma.
  useEffect(() => {
    if (unread > 0) marcarVistos().catch(() => {});
  }, [unread, marcarVistos]);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <PageHeader
        title="Avisos"
        subtitle="Lo que han cambiado los demás en este espacio."
      />

      <PushCard />

      {isError && <Notice tone="danger">{getErrorMessage(error)}</Notice>}

      {isLoading && <Card className="p-8 text-center text-muted">Cargando…</Card>}

      {!isLoading && items.length === 0 && (
        <EmptyState title="Todavía no hay avisos">
          Aquí llega lo que hagan los demás en este espacio: movimientos, categorías, fondos,
          ministerios y altas del equipo. Lo que hagas tú no se te avisa.
        </EmptyState>
      )}

      {items.length > 0 && (
        <Card as="ul" className="divide-y divide-line overflow-hidden">
          {items.map((aviso) => {
            const Icono = ICONOS[aviso.entity] || LuBellRing;
            const fila = (
              <>
                <span
                  aria-hidden="true"
                  className={cx(
                    "h-9 w-9 shrink-0 grid place-items-center rounded-xl",
                    aviso.read ? "bg-surface-2 text-muted" : "bg-accent-soft text-ink"
                  )}
                >
                  <Icono />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">
                    <strong className="font-bold">{aviso.actorName}</strong> {aviso.accion}
                  </span>
                  {aviso.detalle && (
                    <span className="block text-sm text-muted truncate">{aviso.detalle}</span>
                  )}
                  <span className="block text-xs text-muted mt-0.5">{cuando(aviso.createdAt)}</span>
                </span>
                {!aviso.read && (
                  <span
                    aria-hidden="true"
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent"
                  />
                )}
              </>
            );

            return (
              <li key={aviso._id}>
                {aviso.url ? (
                  <Link to={aviso.url} className={FILA}>
                    {fila}
                  </Link>
                ) : (
                  <div className={FILA}>{fila}</div>
                )}
              </li>
            );
          })}
        </Card>
      )}

      {items.length > 0 && (
        <p className="flex items-center justify-center gap-2 text-xs text-muted">
          <LuCheckCheck aria-hidden="true" /> Se muestran los últimos {items.length} cambios. El
          detalle de cada uno está en la sección Historial.
        </p>
      )}
    </div>
  );
};

export default AvisosPage;
