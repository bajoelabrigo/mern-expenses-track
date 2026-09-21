const asyncHandler = require("express-async-handler");
const Workspace = require("../model/Workspace");
const Membership = require("../model/Membership");
const JoinRequest = require("../model/JoinRequest");
const User = require("../model/User");
const { ROLES, ROLE_LABELS, canAssignRole } = require("../utils/permissions");
const { audit } = require("../utils/audit");
const { sendMail, simpleEmail } = require("../utils/mailer");
const { APP_URL } = require("../config/env");

//! Solicitudes para entrar a un espacio que YA existe. Existe porque el registro
//! solo sabe CREAR iglesias: quien escribía el nombre de la suya al registrarse
//! se llevaba una iglesia gemela vacía. Aquí, en cambio, la persona pide entrar a
//! la que ya está, y entra solo si alguien de dentro lo aprueba.
//!
//! Regla que no se rompe: escribir el nombre de una iglesia NO da acceso. Sin
//! aprobación (o invitación) nadie ve sus diezmos.

//! Compara nombres sin distinguir mayúsculas ni tildes ("Altísimo" = "altisimo")
const normalizar = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const MENSAJE_MAX = 300;

//! Vista de una solicitud pendiente para quien puede aprobarla
const requestView = (r) => ({
  _id: r._id,
  userId: r.user?._id || r.user,
  username: r.user?.username || "",
  email: r.user?.email || "",
  message: r.message || "",
  createdAt: r.createdAt,
});

//! a) ¿Existe ya una iglesia con este nombre? SIN sesión: lo usa el formulario de
//! registro para avisar antes de crear una gemela. No devuelve ningún dato de la
//! iglesia: solo si el nombre está tomado y cuántas hay.
exports.churchExists = asyncHandler(async (req, res) => {
  const nombre = normalizar(req.query.nombre);
  if (nombre.length < 3) return res.json({ existe: false, cuantas: 0 });

  const iglesias = await Workspace.find({ kind: "iglesia" }).select("name").lean();
  const cuantas = iglesias.filter((w) => normalizar(w.name) === nombre).length;

  res.json({ existe: cuantas > 0, cuantas });
});

//! b) Buscar iglesias por nombre (con sesión): para pedir entrar. Devuelve lo
//! justo para reconocerla (nombre, quién la creó, cuántos son, de cuándo es),
//! nunca sus cuentas.
exports.search = asyncHandler(async (req, res) => {
  const nombre = normalizar(req.query.nombre);
  if (nombre.length < 3) return res.json([]);

  //! Se filtra en memoria a propósito: son pocas iglesias y así la búsqueda
  //! ignora tildes y mayúsculas sin tocar el esquema ni migrar datos
  const iglesias = await Workspace.find({ kind: "iglesia" }).select("name createdBy createdAt").limit(500).lean();
  const encontradas = iglesias.filter((w) => normalizar(w.name).includes(nombre)).slice(0, 5);
  if (!encontradas.length) return res.json([]);

  const ids = encontradas.map((w) => w._id);
  const [creadores, conteos, mias, pedidas] = await Promise.all([
    User.find({ _id: { $in: encontradas.map((w) => w.createdBy) } }).select("username").lean(),
    Membership.aggregate([
      { $match: { workspace: { $in: ids } } },
      { $group: { _id: "$workspace", n: { $sum: 1 } } },
    ]),
    Membership.find({ user: req.user._id, workspace: { $in: ids } }).select("workspace").lean(),
    JoinRequest.find({ user: req.user._id, workspace: { $in: ids }, acceptedAt: null, rejectedAt: null })
      .select("workspace")
      .lean(),
  ]);

  const porId = new Map(creadores.map((u) => [String(u._id), u.username]));
  const miembros = new Map(conteos.map((c) => [String(c._id), c.n]));
  const soyMiembro = new Set(mias.map((m) => String(m.workspace)));
  const yaPedidas = new Set(pedidas.map((p) => String(p.workspace)));

  res.json(
    encontradas.map((w) => ({
      _id: w._id,
      name: w.name,
      createdAt: w.createdAt,
      members: miembros.get(String(w._id)) || 0,
      createdBy: porId.get(String(w.createdBy)) || "",
      isMember: soyMiembro.has(String(w._id)),
      requested: yaPedidas.has(String(w._id)),
    }))
  );
});

//! c) Pedir entrar. No da acceso: avisa a quien puede aprobar.
exports.create = asyncHandler(async (req, res) => {
  const workspace = await Workspace.findById(req.params.id);
  if (!workspace) return res.status(404).json({ message: "Ese espacio no existe" });

  if (await Membership.exists({ workspace: workspace._id, user: req.user._id })) {
    return res.status(409).json({ message: "Ya eres miembro de ese espacio" });
  }

  const pendiente = await JoinRequest.findOne({
    workspace: workspace._id,
    user: req.user._id,
    acceptedAt: null,
    rejectedAt: null,
  });
  if (pendiente) {
    return res.status(409).json({ message: "Ya pediste entrar; espera la respuesta" });
  }

  const mensaje = String(req.body?.message || "").trim().slice(0, MENSAJE_MAX);

  //! Si ya había pedido antes (y la rechazaron), se reutiliza la fila
  const previa = await JoinRequest.findOne({ workspace: workspace._id, user: req.user._id });
  const solicitud = previa || new JoinRequest({ workspace: workspace._id, user: req.user._id });
  solicitud.message = mensaje;
  solicitud.acceptedAt = null;
  solicitud.rejectedAt = null;
  solicitud.resolvedBy = null;
  await solicitud.save();

  //! Aviso por correo a propietarios y tesoreros. La decisión se toma dentro de
  //! la app; el correo es para que se enteren sin tener que mirar.
  const admins = await Membership.find({
    workspace: workspace._id,
    role: { $in: ["propietario", "tesorero"] },
  })
    .populate("user", "username email")
    .lean();

  const url = `${APP_URL}/espacio/miembros`;
  await Promise.all(
    admins
      .filter((a) => a.user?.email)
      .map((a) =>
        sendMail({
          to: a.user.email,
          subject: `${req.user.username} quiere entrar a "${workspace.name}"`,
          ...simpleEmail({
            title: `${req.user.username} pide entrar a "${workspace.name}"`,
            intro: mensaje
              ? `${req.user.username} (${req.user.email}) quiere entrar y dice: "${mensaje}"`
              : `${req.user.username} (${req.user.email}) quiere entrar a tu espacio como parte del equipo.`,
            buttonText: "Aprobar o rechazar",
            url,
            footer: "Se aprueba en Miembros, dentro de la app. Hasta entonces no ve nada.",
          }),
        })
      )
  );

  res.status(201).json({
    message: `Solicitud enviada a "${workspace.name}". Un propietario o tesorero debe aprobarla.`,
    request: {
      _id: solicitud._id,
      workspace: workspace._id,
      workspaceName: workspace.name,
      createdAt: solicitud.createdAt,
    },
  });
});

//! d) Mis solicitudes pendientes (para ver que siguen en cola y poder retirarlas)
exports.listMine = asyncHandler(async (req, res) => {
  const solicitudes = await JoinRequest.find({
    user: req.user._id,
    acceptedAt: null,
    rejectedAt: null,
  })
    .populate("workspace", "name kind")
    .sort({ createdAt: -1 })
    .lean();

  res.json(
    solicitudes
      .filter((s) => s.workspace)
      .map((s) => ({
        _id: s._id,
        workspace: s.workspace._id,
        workspaceName: s.workspace.name,
        workspaceKind: s.workspace.kind,
        createdAt: s.createdAt,
      }))
  );
});

//! e) Retirar mi propia solicitud
exports.withdraw = asyncHandler(async (req, res) => {
  const solicitud = await JoinRequest.findOne({
    _id: req.params.requestId,
    user: req.user._id,
    acceptedAt: null,
    rejectedAt: null,
  });
  if (!solicitud) return res.status(404).json({ message: "No tienes esa solicitud pendiente" });

  await solicitud.deleteOne();
  res.json({ message: "Solicitud retirada" });
});

//! f) Solicitudes pendientes del espacio (lo ve quien gestiona miembros)
exports.listForWorkspace = asyncHandler(async (req, res) => {
  const solicitudes = await JoinRequest.find({
    workspace: req.workspace._id,
    acceptedAt: null,
    rejectedAt: null,
  })
    .populate("user", "username email")
    .sort({ createdAt: 1 })
    .lean();

  res.json(solicitudes.filter((s) => s.user).map(requestView));
});

//! g) Aprobar: aquí SÍ entra, con el rol que elige quien aprueba
exports.approve = asyncHandler(async (req, res) => {
  const { role } = req.body || {};

  if (!ROLES.includes(role)) {
    return res.status(400).json({ message: "Rol no válido" });
  }
  if (!canAssignRole(req.role, role)) {
    return res
      .status(403)
      .json({ message: "Tu rol no permite dar ese rol" });
  }

  const solicitud = await JoinRequest.findOne({
    _id: req.params.requestId,
    workspace: req.workspace._id,
    acceptedAt: null,
    rejectedAt: null,
  }).populate("user", "username email");
  if (!solicitud || !solicitud.user) {
    return res.status(404).json({ message: "Solicitud no encontrada" });
  }

  const yaEra = await Membership.exists({
    workspace: req.workspace._id,
    user: solicitud.user._id,
  });

  if (!yaEra) {
    await Membership.create({
      workspace: req.workspace._id,
      user: solicitud.user._id,
      role,
    });
  }

  solicitud.acceptedAt = new Date();
  solicitud.resolvedBy = req.user._id;
  await solicitud.save();

  await audit(req, {
    action: "member.add",
    entity: "member",
    entityId: solicitud.user._id,
    after: { email: solicitud.user.email, role },
    note: "Aprobó su solicitud para entrar",
  });

  await sendMail({
    to: solicitud.user.email,
    subject: `Ya puedes entrar a "${req.workspace.name}"`,
    ...simpleEmail({
      title: `Ya tienes acceso a "${req.workspace.name}"`,
      intro: `${req.user.username} aprobó tu solicitud: entras como ${ROLE_LABELS[role]}. El espacio aparecerá en tu lista al entrar.`,
      buttonText: "Entrar a la app",
      url: `${APP_URL}/dashboard`,
      footer: "No hay nada que confirmar.",
    }),
  });

  res.json({
    message: yaEra
      ? `${solicitud.user.username} ya era miembro: solicitud cerrada`
      : `${solicitud.user.username} ya tiene acceso a "${req.workspace.name}" como ${ROLE_LABELS[role]}`,
    userId: solicitud.user._id,
    role,
  });
});

//! h) Rechazar (sin dar acceso, y avisando)
exports.reject = asyncHandler(async (req, res) => {
  const solicitud = await JoinRequest.findOne({
    _id: req.params.requestId,
    workspace: req.workspace._id,
    acceptedAt: null,
    rejectedAt: null,
  }).populate("user", "username email");
  if (!solicitud || !solicitud.user) {
    return res.status(404).json({ message: "Solicitud no encontrada" });
  }

  solicitud.rejectedAt = new Date();
  solicitud.resolvedBy = req.user._id;
  await solicitud.save();

  await sendMail({
    to: solicitud.user.email,
    subject: `Tu solicitud para "${req.workspace.name}" no fue aceptada`,
    ...simpleEmail({
      title: `No pudieron aceptarte en "${req.workspace.name}"`,
      intro: `Quien administra "${req.workspace.name}" no aceptó tu solicitud. Si crees que es un error, habla con esa persona.`,
      buttonText: "Ir a la app",
      url: `${APP_URL}/espacios`,
      footer: "No tienes acceso a ese espacio.",
    }),
  });

  res.json({ message: "Solicitud rechazada" });
});
