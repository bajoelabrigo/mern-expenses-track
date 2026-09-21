const asyncHandler = require("express-async-handler");
const PushSubscription = require("../model/PushSubscription");
const notificaciones = require("../services/notificationService");
const push = require("../services/pushService");

//! Avisos del espacio: la campana. Se leen del historial de auditoría (ver
//! services/notificationService), así que aquí solo se filtra por rol.

//! a) Los avisos, del más nuevo al más viejo
exports.list = asyncHandler(async (req, res) => {
  const { items, unread } = await notificaciones.listar({
    workspace: req.workspace,
    userId: req.user._id,
    role: req.role,
    limit: req.query.limit,
  });

  res.json({ items, unread });
});

//! b) Dar por leídos los de este espacio
exports.markRead = asyncHandler(async (req, res) => {
  await notificaciones.marcarLeidas({
    workspace: req.workspace,
    userId: req.user._id,
  });

  res.json({ message: "Avisos vistos", unread: 0 });
});

//! c) Estado de los avisos al teléfono: si el servidor los tiene configurados,
//! con qué clave se suscribe el navegador y qué aparatos hay apuntados.
exports.pushStatus = asyncHandler(async (req, res) => {
  const aparatos = await PushSubscription.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    disponible: push.configurado(),
    publicKey: push.publicKey(),
    aparatos: aparatos.map((aparato) => ({
      endpoint: aparato.endpoint,
      nombre: aparato.userAgent,
      desde: aparato.createdAt,
    })),
  });
});

//! d) Activar los avisos en ESTE aparato
exports.subscribe = asyncHandler(async (req, res) => {
  if (!push.configurado()) {
    return res.status(503).json({
      message:
        "Los avisos al teléfono todavía no están configurados en el servidor. La campana de la app funciona igual.",
      code: "PUSH_NOT_CONFIGURED",
    });
  }

  const guardada = await push.guardar({
    user: req.user,
    subscription: req.body?.subscription,
    userAgent: req.headers["user-agent"],
  });

  if (!guardada) {
    return res.status(400).json({ message: "La suscripción del aparato no es válida" });
  }

  res.status(201).json({
    message: "Avisos activados en este aparato",
    endpoint: guardada.endpoint,
    nombre: guardada.userAgent,
  });
});

//! e) Apagarlos en este aparato (solo el dueño puede quitar los suyos)
exports.unsubscribe = asyncHandler(async (req, res) => {
  const endpoint = String(req.body?.endpoint || "");
  if (endpoint) await push.borrar({ user: req.user, endpoint });

  res.json({ message: "Avisos apagados en este aparato" });
});

//! f) Mandarse un aviso de prueba, para comprobar que el teléfono los recibe
exports.test = asyncHandler(async (req, res) => {
  if (!push.configurado()) {
    return res.status(503).json({
      message: "Los avisos al teléfono todavía no están configurados en el servidor.",
      code: "PUSH_NOT_CONFIGURED",
    });
  }

  const enviados = await push.enviarA({
    userId: req.user._id,
    payload: {
      title: "Avisos activados",
      body: `Así se verán los avisos de ${req.workspace.name}`,
      url: "/avisos",
      tag: "prueba",
    },
  });

  res.json({
    enviados,
    message:
      enviados > 0
        ? `Enviado a ${enviados} aparato${enviados === 1 ? "" : "s"}`
        : "No hay ningún aparato con los avisos activados",
  });
});
