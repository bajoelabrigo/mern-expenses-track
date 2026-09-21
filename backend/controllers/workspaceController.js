const crypto = require("crypto");
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const Workspace = require("../model/Workspace");
const Membership = require("../model/Membership");
const Invitation = require("../model/Invitation");
const Transaction = require("../model/Transaccion");
const Category = require("../model/Category");
const Fund = require("../model/Fund");
const Donor = require("../model/Donor");
const FundTransfer = require("../model/FundTransfer");
const AuditLog = require("../model/AuditLog");
const { logoStorage } = require("../services/logoStorage");
const OfferingCount = require("../model/OfferingCount");
const PublicReport = require("../model/PublicReport");
const User = require("../model/User");
const {
  createWorkspace,
  listUserWorkspaces,
  repairDefaultWorkspace,
} = require("../services/workspaceService");
const { ROLES, permissionsFor, canAssignRole, can } = require("../utils/permissions");
const { CURRENCIES } = require("../utils/money");
const { audit } = require("../utils/audit");
const { sendMail, simpleEmail } = require("../utils/mailer");
const { APP_URL } = require("../config/env");
const { receiptStorage } = require("../services/receiptStorage");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KINDS = ["personal", "iglesia"];
const MAX_AUDIT_LIMIT = 100;

const ROLE_LABELS = {
  propietario: "propietario",
  tesorero: "tesorero",
  contador: "contador",
  auditor: "auditor (solo lectura)",
  lector: "lector (solo lectura)",
};

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

//! Lo que el cliente necesita de un espacio para pintar la interfaz
const workspaceView = (workspace, role, defaultId) => ({
  _id: workspace._id,
  name: workspace.name,
  kind: workspace.kind,
  currency: workspace.currency,
  //! Solo la URL: el resto de datos del logo es cosa del servidor
  logo: workspace.logo?.url || "",
  role,
  permissions: permissionsFor(role),
  isDefault: defaultId ? String(workspace._id) === String(defaultId) : false,
});

//! Un tesorero solo gestiona a contadores, auditores, lectores y líderes de
//! ministerio; el propietario, a todos. Los mismos roles que puede asignar
//! (canAssignRole): si pudiera nombrar a un líder y después no tocarlo, lo
//! dejaría puesto para siempre.
const canManageMember = (actorRole, memberRole) =>
  actorRole === "propietario" ||
  (actorRole === "tesorero" &&
    ["contador", "auditor", "lector", "lider"].includes(memberRole));

const countOwners = (workspaceId) =>
  Membership.countDocuments({ workspace: workspaceId, role: "propietario" });

//! Mongoose no castea dentro de un agregado ni en comparaciones a mano
const sameId = (a, b) => String(a) === String(b);

//! a) Mis espacios
exports.listMine = asyncHandler(async (req, res) => {
  const defaultId = await repairDefaultWorkspace(req.user);
  const items = await listUserWorkspaces(req.user);
  res.json(items.map(({ workspace, role }) => workspaceView(workspace, role, defaultId)));
});

//! b) Crear un espacio (quien lo crea queda de propietario)
exports.create = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const kind = req.body?.kind || "iglesia";
  const { currency } = req.body || {};

  if (name.length < 2) {
    return res
      .status(400)
      .json({ message: "El nombre debe tener al menos 2 caracteres" });
  }
  if (!KINDS.includes(kind)) {
    return res.status(400).json({ message: "Tipo de espacio inválido" });
  }
  if (currency !== undefined && !CURRENCIES.includes(currency)) {
    return res.status(400).json({ message: "Moneda no admitida" });
  }

  const workspace = await createWorkspace({ name, kind, currency, owner: req.user });

  req.workspace = workspace;
  await audit(req, {
    action: "workspace.create",
    entity: "workspace",
    entityId: workspace._id,
    after: { name, kind, currency: workspace.currency },
  });

  res
    .status(201)
    .json(workspaceView(workspace, "propietario", req.user.defaultWorkspace));
});

//! c) Detalle del espacio (req.workspace lo resolvió el middleware)
exports.getOne = asyncHandler(async (req, res) => {
  res.json({
    ...workspaceView(req.workspace, req.role, req.user.defaultWorkspace),
    createdAt: req.workspace.createdAt,
  });
});

//! d) Ajustes: nombre y moneda
exports.update = asyncHandler(async (req, res) => {
  const { name, currency } = req.body || {};
  const before = { name: req.workspace.name, currency: req.workspace.currency };

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (trimmed.length < 2) {
      return res
        .status(400)
        .json({ message: "El nombre debe tener al menos 2 caracteres" });
    }
    req.workspace.name = trimmed;
  }

  if (currency !== undefined) {
    if (!CURRENCIES.includes(currency)) {
      return res.status(400).json({ message: "Moneda no admitida" });
    }
    //! Cambiar la moneda NO convierte los montos: solo cambia cómo se leen.
    //! Es para corregir una moneda mal elegida, no para "pasar a euros".
    req.workspace.currency = currency;
  }

  await req.workspace.save();

  await audit(req, {
    action: "workspace.update",
    entity: "workspace",
    entityId: req.workspace._id,
    before,
    after: { name: req.workspace.name, currency: req.workspace.currency },
  });

  res.json(workspaceView(req.workspace, req.role, req.user.defaultWorkspace));
});

//! d.2) Logo de la iglesia, el que sale impreso en informes y constancias
exports.setLogo = asyncHandler(async (req, res) => {
  if (!logoStorage.isConfigured()) {
    return res.status(503).json({
      message: "Todavía no se puede guardar el logo. Inténtalo más tarde.",
    });
  }

  let saved;
  try {
    saved = await logoStorage.upload({
      buffer: req.file.buffer,
      workspaceId: req.workspace._id,
    });
  } catch {
    return res.status(502).json({ message: "No se pudo guardar el logo. Inténtalo de nuevo." });
  }

  const before = { logo: req.workspace.logo?.url || "" };
  req.workspace.logo = {
    publicId: saved.publicId,
    url: saved.url,
    width: saved.width,
    height: saved.height,
  };
  await req.workspace.save();

  await audit(req, {
    action: "workspace.logo",
    entity: "workspace",
    entityId: req.workspace._id,
    before,
    after: { logo: saved.url },
  });

  res.json(workspaceView(req.workspace, req.role, req.user.defaultWorkspace));
});

exports.removeLogo = asyncHandler(async (req, res) => {
  const { publicId, url } = req.workspace.logo || {};
  if (!url) return res.status(404).json({ message: "Este espacio no tiene logo" });

  //! Si Cloudinary falla se quita igual de la app: lo que el usuario pidió es
  //! dejar de usarlo, y un archivo huérfano no hace daño.
  if (publicId) {
    try {
      await logoStorage.destroy({ publicId });
    } catch {
      /* se ignora a propósito */
    }
  }

  req.workspace.logo = { publicId: "", url: "", width: 0, height: 0 };
  await req.workspace.save();

  await audit(req, {
    action: "workspace.logo",
    entity: "workspace",
    entityId: req.workspace._id,
    before: { logo: url },
    after: { logo: "" },
  });

  res.json(workspaceView(req.workspace, req.role, req.user.defaultWorkspace));
});

//! e) Borrar el espacio con todo su contenido. Exige escribir el nombre: no se
//! puede deshacer.
exports.remove = asyncHandler(async (req, res) => {
  const confirmName = String(req.body?.confirmName || "").trim();
  if (confirmName !== req.workspace.name) {
    return res.status(400).json({
      message: "Escribe el nombre exacto del espacio para confirmar el borrado",
    });
  }

  const workspaceId = req.workspace._id;
  const members = await Membership.find({ workspace: workspaceId }).select("user").lean();

  await Promise.all([
    Transaction.deleteMany({ workspace: workspaceId }),
    Category.deleteMany({ workspace: workspaceId }),
    Fund.deleteMany({ workspace: workspaceId }),
    Donor.deleteMany({ workspace: workspaceId }),
    FundTransfer.deleteMany({ workspace: workspaceId }),
    OfferingCount.deleteMany({ workspace: workspaceId }),
    PublicReport.deleteMany({ workspace: workspaceId }),
    Invitation.deleteMany({ workspace: workspaceId }),
    AuditLog.deleteMany({ workspace: workspaceId }),
    Membership.deleteMany({ workspace: workspaceId }),
  ]);
  await req.workspace.deleteOne();

  //! Y sus comprobantes en Cloudinary (carpeta del espacio)
  if (receiptStorage.isConfigured()) {
    await receiptStorage.destroyWorkspace(String(workspaceId)).catch((err) =>
      console.error(`[receipt] No se borraron los de ${workspaceId}:`, err.message)
    );
  }

  //! Quien lo tenía como predeterminado pasa a otro de sus espacios la próxima
  //! vez (repairDefaultWorkspace); aquí solo se limpia la referencia.
  await User.updateMany(
    { _id: { $in: members.map((m) => m.user) }, defaultWorkspace: workspaceId },
    { defaultWorkspace: null }
  );

  res.json({ message: "Espacio eliminado" });
});

//! f) Miembros del espacio. Los correos solo los ve quien gestiona miembros.
exports.listMembers = asyncHandler(async (req, res) => {
  const memberships = await Membership.find({ workspace: req.workspace._id })
    .populate("user", "username email")
    .sort({ createdAt: 1 })
    .lean();

  const showEmail = can(req.role, "members:manage");

  res.json(
    memberships
      .filter((m) => m.user)
      .map((m) => ({
        userId: m.user._id,
        username: m.user.username,
        ...(showEmail ? { email: m.user.email } : {}),
        role: m.role,
        joinedAt: m.createdAt,
        isMe: sameId(m.user._id, req.user._id),
      }))
  );
});

//! f.2) Agregar directamente a alguien que YA tiene cuenta en la app. No hay
//! invitación ni correo de confirmación: la persona entra al instante. Si el
//! correo no está registrado responde 404 con code USER_NOT_FOUND para que el
//! cliente ofrezca enviarle una invitación (que es la única forma de que se
//! registre).
exports.addMember = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  const { role } = req.body || {};

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: "Formato de correo inválido" });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ message: "Rol no válido" });
  }
  if (!canAssignRole(req.role, role)) {
    return res
      .status(403)
      .json({ message: "Tu rol no permite agregar a alguien con ese rol" });
  }

  const user = await User.findOne({ email }).select("username email");
  if (!user) {
    return res.status(404).json({
      message: "Esa persona todavía no tiene cuenta en la app. Envíale una invitación.",
      code: "USER_NOT_FOUND",
    });
  }

  if (await Membership.exists({ workspace: req.workspace._id, user: user._id })) {
    return res.status(409).json({ message: "Esa persona ya es miembro del espacio" });
  }

  let membership;
  try {
    membership = await Membership.create({
      workspace: req.workspace._id,
      user: user._id,
      role,
    });
  } catch (err) {
    //! Dos administradores a la vez: decide el índice único y el segundo avisa
    //! en vez de reventar con un error de servidor
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Esa persona ya es miembro del espacio" });
    }
    throw err;
  }

  //! Si tenía una invitación pendiente ya no sirve: entró por aquí. Se revoca
  //! para que no siga apareciendo en la lista de pendientes.
  await Invitation.updateMany(
    { workspace: req.workspace._id, email, acceptedAt: null, revokedAt: null },
    { revokedAt: new Date() }
  );

  await audit(req, {
    action: "member.add",
    entity: "member",
    entityId: user._id,
    after: { email, role },
  });

  //! Un aviso, no una confirmación: ya tiene acceso y el correo solo se lo
  //! cuenta. Si el envío falla, el alta sigue hecha.
  const mail = await sendMail({
    to: email,
    subject: `Ya tienes acceso a "${req.workspace.name}"`,
    ...simpleEmail({
      title: `Ya tienes acceso a "${req.workspace.name}"`,
      intro: `${req.user.username} te agregó a "${req.workspace.name}" como ${ROLE_LABELS[role]}. Entra con tu cuenta cuando quieras: no hay nada que confirmar.`,
      buttonText: "Entrar a la app",
      url: `${APP_URL}/dashboard`,
      footer: "Si no esperabas esto, avisa a quien te agregó.",
    }),
  });

  res.status(201).json({
    message: `${user.username} ya tiene acceso como ${ROLE_LABELS[role]}`,
    emailSent: mail.sent,
    member: {
      userId: user._id,
      username: user.username,
      email: user.email,
      role,
      joinedAt: membership.createdAt,
      isMe: sameId(user._id, req.user._id),
    },
  });
});

//! g) Cambiar el rol de un miembro
exports.updateMemberRole = asyncHandler(async (req, res) => {
  const { role } = req.body || {};

  if (!ROLES.includes(role)) {
    return res.status(400).json({ message: "Rol no válido" });
  }

  const membership = await Membership.findOne({
    workspace: req.workspace._id,
    user: req.params.userId,
  });
  if (!membership) {
    return res.status(404).json({ message: "Esa persona no es miembro del espacio" });
  }

  if (!canManageMember(req.role, membership.role) || !canAssignRole(req.role, role)) {
    return res
      .status(403)
      .json({ message: "Tu rol no permite asignar ese rol a esta persona" });
  }

  if (membership.role === "propietario" && role !== "propietario") {
    if ((await countOwners(req.workspace._id)) <= 1) {
      return res.status(409).json({
        message: "El espacio debe tener al menos un propietario. Nombra otro antes.",
      });
    }
  }

  const before = { role: membership.role };
  membership.role = role;
  await membership.save();

  await audit(req, {
    action: "member.role",
    entity: "member",
    entityId: membership.user,
    before,
    after: { role },
  });

  res.json({ message: "Rol actualizado", userId: membership.user, role });
});

//! h) Quitar a un miembro (o salir uno mismo)
exports.removeMember = asyncHandler(async (req, res) => {
  const membership = await Membership.findOne({
    workspace: req.workspace._id,
    user: req.params.userId,
  });
  if (!membership) {
    return res.status(404).json({ message: "Esa persona no es miembro del espacio" });
  }

  const isSelf = sameId(membership.user, req.user._id);
  if (!isSelf && !canManageMember(req.role, membership.role)) {
    return res
      .status(403)
      .json({ message: "Tu rol no permite quitar a esta persona" });
  }

  if (membership.role === "propietario" && (await countOwners(req.workspace._id)) <= 1) {
    return res.status(409).json({
      message: "El espacio debe tener al menos un propietario. Nombra otro antes.",
    });
  }

  await membership.deleteOne();

  //! Si era su espacio predeterminado, el siguiente acceso elige otro
  await User.updateOne(
    { _id: membership.user, defaultWorkspace: req.workspace._id },
    { defaultWorkspace: null }
  );

  await audit(req, {
    action: isSelf ? "member.leave" : "member.remove",
    entity: "member",
    entityId: membership.user,
    before: { role: membership.role },
  });

  res.json({ message: isSelf ? "Saliste del espacio" : "Miembro quitado" });
});

//! i) Invitaciones pendientes
exports.listInvitations = asyncHandler(async (req, res) => {
  const invitations = await Invitation.find({
    workspace: req.workspace._id,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .populate("invitedBy", "username")
    .sort({ createdAt: -1 })
    .lean();

  res.json(
    invitations.map((inv) => ({
      _id: inv._id,
      email: inv.email,
      role: inv.role,
      invitedBy: inv.invitedBy?.username || "",
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }))
  );
});

//! j) Invitar. Devuelve el enlace para poder compartirlo también por WhatsApp,
//! que en muchas iglesias llega antes que un correo.
exports.createInvitation = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  const { role } = req.body || {};

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: "Formato de correo inválido" });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ message: "Rol no válido" });
  }
  if (!canAssignRole(req.role, role)) {
    return res
      .status(403)
      .json({ message: "Tu rol no permite invitar con ese rol" });
  }

  const existingUser = await User.findOne({ email }).select("_id");
  if (
    existingUser &&
    (await Membership.exists({ workspace: req.workspace._id, user: existingUser._id }))
  ) {
    return res.status(409).json({ message: "Esa persona ya es miembro del espacio" });
  }

  //! Una sola invitación viva por correo: la nueva sustituye a la anterior
  await Invitation.updateMany(
    { workspace: req.workspace._id, email, acceptedAt: null, revokedAt: null },
    { revokedAt: new Date() }
  );

  const token = crypto.randomBytes(32).toString("hex");
  const invitation = await Invitation.create({
    workspace: req.workspace._id,
    email,
    role,
    tokenHash: hashToken(token),
    invitedBy: req.user._id,
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
  });

  const url = `${APP_URL}/invitacion/${token}`;
  const mail = await sendMail({
    to: email,
    subject: `Te invitaron a "${req.workspace.name}"`,
    ...simpleEmail({
      title: `Te invitaron a "${req.workspace.name}"`,
      intro: `${req.user.username} te invitó a llevar las cuentas de "${req.workspace.name}" como ${ROLE_LABELS[role]}. La invitación vale 7 días.`,
      buttonText: "Aceptar la invitación",
      url,
      footer: "Si no esperabas esta invitación, puedes ignorar este correo.",
    }),
  });

  await audit(req, {
    action: "invitation.create",
    entity: "invitation",
    entityId: invitation._id,
    after: { email, role },
  });

  res.status(201).json({
    _id: invitation._id,
    email,
    role,
    expiresAt: invitation.expiresAt,
    url,
    emailSent: mail.sent,
  });
});

//! k) Revocar una invitación pendiente
exports.revokeInvitation = asyncHandler(async (req, res) => {
  const invitation = await Invitation.findOne({
    _id: req.params.invitationId,
    workspace: req.workspace._id,
    acceptedAt: null,
    revokedAt: null,
  });
  if (!invitation) {
    return res.status(404).json({ message: "Invitación no encontrada" });
  }

  invitation.revokedAt = new Date();
  await invitation.save();

  await audit(req, {
    action: "invitation.revoke",
    entity: "invitation",
    entityId: invitation._id,
    before: { email: invitation.email, role: invitation.role },
  });

  res.json({ message: "Invitación revocada" });
});

//! l) Historial de cambios del espacio (paginado, opcionalmente de una fila)
exports.listAudit = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    MAX_AUDIT_LIMIT,
    Math.max(1, parseInt(req.query.limit, 10) || 30)
  );

  const filters = { workspace: req.workspace._id };
  if (req.query.entityId) {
    if (!mongoose.Types.ObjectId.isValid(req.query.entityId)) {
      return res.status(400).json({ message: "Identificador inválido" });
    }
    filters.entityId = req.query.entityId;
  }

  //! Lo de los aportantes (quién dio cuánto) solo lo ve la tesorería
  if (!can(req.role, "donor:read")) filters.entity = { $ne: "donor" };

  const [total, entries] = await Promise.all([
    AuditLog.countDocuments(filters),
    AuditLog.find(filters)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  res.json({
    total,
    currentPage: page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    entries,
  });
});

//! ── Rutas públicas de invitación (por token) ──

const findLiveInvitation = async (token) => {
  const invitation = await Invitation.findOne({ tokenHash: hashToken(String(token || "")) })
    .populate("workspace", "name kind")
    .populate("invitedBy", "username");

  if (!invitation || !invitation.workspace) return { error: 404 };
  if (invitation.revokedAt) return { error: 410, invitation };
  if (invitation.acceptedAt) return { error: 409, invitation };
  if (invitation.expiresAt <= new Date()) return { error: 410, invitation };
  return { invitation };
};

//! m) Ver una invitación antes de aceptarla (sin sesión)
exports.previewInvitation = asyncHandler(async (req, res) => {
  const { invitation, error } = await findLiveInvitation(req.params.token);

  if (error === 404) {
    return res.status(404).json({ message: "La invitación no existe" });
  }
  if (error === 409) {
    return res.status(409).json({ message: "Esta invitación ya fue aceptada" });
  }
  if (error === 410) {
    return res
      .status(410)
      .json({ message: "La invitación caducó o fue revocada. Pide una nueva." });
  }

  res.json({
    workspaceName: invitation.workspace.name,
    workspaceKind: invitation.workspace.kind,
    role: invitation.role,
    email: invitation.email,
    invitedBy: invitation.invitedBy?.username || "",
    expiresAt: invitation.expiresAt,
  });
});

//! n) Aceptar la invitación (con sesión, y con el MISMO correo invitado: el
//! enlace reenviado a otra persona no le da acceso)
exports.acceptInvitation = asyncHandler(async (req, res) => {
  const { invitation, error } = await findLiveInvitation(req.params.token);

  if (error === 404) {
    return res.status(404).json({ message: "La invitación no existe" });
  }
  if (error === 409) {
    return res.status(409).json({ message: "Esta invitación ya fue aceptada" });
  }
  if (error === 410) {
    return res
      .status(410)
      .json({ message: "La invitación caducó o fue revocada. Pide una nueva." });
  }

  if (invitation.email !== req.user.email) {
    return res.status(403).json({
      message: `Esta invitación es para ${invitation.email}. Inicia sesión con esa cuenta.`,
      code: "EMAIL_MISMATCH",
    });
  }

  const workspaceId = invitation.workspace._id;
  const already = await Membership.exists({ workspace: workspaceId, user: req.user._id });

  if (!already) {
    await Membership.create({
      workspace: workspaceId,
      user: req.user._id,
      role: invitation.role,
    });
  }

  invitation.acceptedAt = new Date();
  invitation.acceptedBy = req.user._id;
  await invitation.save();

  req.workspace = invitation.workspace;
  await audit(req, {
    action: "invitation.accept",
    entity: "member",
    entityId: req.user._id,
    after: { role: invitation.role },
  });

  const workspace = await Workspace.findById(workspaceId);
  const membership = await Membership.findOne({ workspace: workspaceId, user: req.user._id });

  res.json({
    message: already
      ? "Ya eras miembro de este espacio"
      : `Te uniste a "${workspace.name}"`,
    workspace: workspaceView(workspace, membership.role, req.user.defaultWorkspace),
  });
});
