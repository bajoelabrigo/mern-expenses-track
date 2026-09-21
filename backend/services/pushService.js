const webpush = require("web-push");
const PushSubscription = require("../model/PushSubscription");
const {
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
} = require("../config/env");

//! Avisos al teléfono (Web Push). Sin claves configuradas esto queda apagado y
//! la app sigue teniendo su campana dentro: la sección de avisos avisa de que
//! los del sistema no están disponibles en vez de fallar.
//!
//! Las claves se generan UNA vez con `npx web-push generate-vapid-keys` y se
//! ponen en el entorno del servidor. Cambiarlas invalida las suscripciones que
//! ya existen (los aparatos tienen que volver a activarlos).

const configurado = () => Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (configurado()) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

//! Solo la mitad pública: con ella el navegador crea la suscripción
const publicKey = () => (configurado() ? VAPID_PUBLIC_KEY : null);

const comoAparato = (userAgent = "") => {
  const ua = String(userAgent);
  if (/Android/i.test(ua)) return /Chrome/i.test(ua) ? "Chrome en Android" : "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone o iPad";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Este aparato";
};

//! Guarda (o refresca) la suscripción de un aparato. El endpoint es la llave:
//! si ya existía, se queda con el dueño nuevo y sus claves al día.
const guardar = async ({ user, subscription, userAgent }) => {
  const endpoint = String(subscription?.endpoint || "");
  const p256dh = String(subscription?.keys?.p256dh || "");
  const auth = String(subscription?.keys?.auth || "");

  //! Sin dueño no se guarda: `findOneAndUpdate` no valida por defecto y quedaría
  //! una suscripción huérfana, imposible de apagar desde ningún usuario.
  if (!endpoint || !p256dh || !auth || !user?._id) return null;

  return PushSubscription.findOneAndUpdate(
    { endpoint },
    { user: user._id, endpoint, p256dh, auth, userAgent: comoAparato(userAgent) },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
};

//! Quitar el aparato. Se filtra por dueño: nadie borra la suscripción de otro.
const borrar = async ({ user, endpoint }) =>
  PushSubscription.deleteOne({ user: user._id, endpoint });

const olvidar = (endpoint) =>
  PushSubscription.deleteOne({ endpoint }).catch(() => {});

//! Manda el aviso a todos los aparatos de esa persona. Nunca lanza: un aviso
//! que no llega no puede tumbar el cambio que ya se hizo.
const enviarA = async ({ userId, payload }) => {
  if (!configurado()) return 0;

  const aparatos = await PushSubscription.find({ user: userId }).lean();
  let enviados = 0;

  await Promise.all(
    aparatos.map(async (aparato) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: aparato.endpoint,
            keys: { p256dh: aparato.p256dh, auth: aparato.auth },
          },
          JSON.stringify(payload),
          { TTL: 12 * 60 * 60 }
        );
        enviados++;
        await PushSubscription.updateOne(
          { _id: aparato._id },
          { lastSentAt: new Date() }
        );
      } catch (err) {
        //! 404 y 410 son "ese aparato ya no existe" (app desinstalada, permiso
        //! retirado): se olvida para no reintentar en cada cambio.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await olvidar(aparato.endpoint);
        } else {
          console.error(
            `[push] No se pudo avisar a ${userId}:`,
            err?.statusCode || err?.message
          );
        }
      }
    })
  );

  return enviados;
};

module.exports = { configurado, publicKey, guardar, borrar, enviarA, comoAparato };
