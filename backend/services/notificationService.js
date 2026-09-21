const AuditLog = require("../model/AuditLog");
const Membership = require("../model/Membership");
const { can } = require("../utils/permissions");
const { formatMoney } = require("../utils/money");
const push = require("./pushService");

//! Avisos de lo que cambia en el espacio.
//!
//! NO hay una tabla de avisos: la campana lee el **historial de auditoría**, que
//! ya registra todos los cambios con autor, acción y fecha. Así no hay dos
//! listas que se puedan desincronizar, y cualquier acción que se añada mañana
//! aparece sola.
//!
//! Lo que sí se decide aquí es **qué ve cada rol**: el historial crudo lleva los
//! datos sensibles (nombres de aportantes, correos, importes), y la campana la
//! abre cualquiera del espacio. Cada acción se cuenta según el rol que mira; si
//! no le corresponde, no aparece ni se le manda al teléfono.

const LIMITE = 40;
const LIMITE_MAX = 120;
//! Tope de entradas que se revisan para contar las no leídas
const TOPE_CONTEO = 200;

const lista = (...partes) => partes.filter(Boolean).join(" · ");

const dinero = (valor, ctx) =>
  valor === null || valor === undefined ? null : formatMoney(valor, ctx.currency);

//! Cómo se cuenta cada cambio.
//! `accion` es lo que hizo la persona, sin su nombre (el cliente lo pone
//! delante); `detalle` son los datos que ayudan a entenderlo. Devolver null
//! significa "este rol no tiene por qué enterarse de este cambio".
const CAMBIOS = {
  //! ── Movimientos: solo quien ve el libro ──
  "transaction.create": (a, b, ctx) => ({
    accion: a?.type === "income" ? "registró un ingreso" : "registró un gasto",
    detalle: lista(
      dinero(a?.amount, ctx),
      a?.category && `«${a.category}»`,
      a?.fund && `fondo ${a.fund}`,
      a?.description
    ),
    url: "/movimientos",
  }),
  "transaction.update": (a, b, ctx) => ({
    accion: "corrigió un movimiento",
    detalle: lista(dinero(a?.amount, ctx), a?.category && `«${a.category}»`),
    url: "/movimientos",
  }),
  "transaction.void": (a, b, ctx) => ({
    accion: "anuló un movimiento",
    detalle: lista(dinero(a?.amount, ctx), a?.voidReason && `«${a.voidReason}»`),
    url: "/movimientos",
  }),
  "transaction.restore": () => ({
    accion: "volvió a poner un movimiento anulado",
    url: "/movimientos",
  }),
  "transaction.purge": (a, b, ctx) => ({
    accion: "borró un movimiento para siempre",
    detalle: dinero(a?.amount, ctx),
    url: "/movimientos",
  }),
  "receipt.remove": () => ({
    accion: "le quitó el comprobante a un movimiento",
    url: "/movimientos",
  }),

  //! ── Categorías, fondos y pases: el libro ──
  "category.create": (a) => ({ accion: `creó la categoría «${a?.name}»`, url: "/categories" }),
  "category.update": (a) => ({ accion: `cambió la categoría «${a?.name}»`, url: "/categories" }),
  "category.delete": (a, b) => ({
    accion: `borró la categoría «${b?.name || a?.name || ""}»`,
    url: "/categories",
  }),
  "fund.create": (a) => ({ accion: `creó el fondo «${a?.name}»`, url: "/fondos" }),
  "fund.update": (a) => ({
    accion: a?.archived ? `archivó el fondo «${a?.name}»` : `cambió el fondo «${a?.name}»`,
    url: "/fondos",
  }),
  "fund.delete": (a, b) => ({
    accion: `borró el fondo «${b?.name || a?.name || ""}»`,
    url: "/fondos",
  }),
  "fund.transfer": (a, b, ctx) => ({
    accion: "pasó dinero de un fondo a otro",
    detalle: lista(dinero(a?.amount, ctx), a?.from && `${a.from} → ${a.to}`),
    url: "/fondos",
  }),

  //! ── Personas: solo quien puede verlas. A los demás se les cuenta sin nombres ──
  "donor.create": (a, b, ctx) =>
    can(ctx.role, "donor:read")
      ? { accion: `cargó a «${a?.name}» en personas`, url: "/aportantes" }
      : { accion: "cargó una persona en la lista", url: "/aportantes" },
  "donor.update": (a, b, ctx) =>
    can(ctx.role, "donor:read")
      ? { accion: `cambió la ficha de «${a?.name}»`, url: "/aportantes" }
      : { accion: "cambió la ficha de una persona", url: "/aportantes" },
  "donor.delete": (a, b, ctx) =>
    can(ctx.role, "donor:read")
      ? { accion: `borró a «${b?.name || a?.name || ""}» de personas`, url: "/aportantes" }
      : { accion: "borró a una persona de la lista", url: "/aportantes" },

  //! ── Equipo: los correos solo para quien gestiona miembros ──
  "member.add": (a, b, ctx) => ({
    accion: can(ctx.role, "members:manage")
      ? `sumó a ${a?.email} como ${a?.role}`
      : "sumó a alguien al equipo",
    detalle: a?.note || null,
    url: "/espacio/miembros",
  }),
  "member.role": (a, b, ctx) => ({
    accion: can(ctx.role, "members:manage")
      ? `le cambió el rol a ${b?.email || a?.email || "alguien"}: ahora es ${a?.role}`
      : "le cambió el rol a alguien del equipo",
    url: "/espacio/miembros",
  }),
  "invitation.create": (a, b, ctx) => ({
    accion: can(ctx.role, "members:manage")
      ? `invitó a ${a?.email} como ${a?.role}`
      : "envió una invitación",
    url: "/espacio/miembros",
  }),
  "invitation.revoke": () => ({ accion: "anuló una invitación", url: "/espacio/miembros" }),
  "invitation.accept": (a, b, ctx) => ({
    accion: can(ctx.role, "members:manage")
      ? `aceptó la invitación de ${a?.email || "alguien"}`
      : "entró alguien nuevo al equipo",
    url: "/espacio/miembros",
  }),

  //! ── Ministerios y su plan del año ──
  "ministry.create": (a, b, ctx) =>
    can(ctx.role, "ministry:read")
      ? {
          accion: `creó el ministerio «${a?.name}»`,
          detalle: lista(a?.year && `plan ${a.year}`, a?.budget && dinero(a.budget, ctx)),
          url: "/ministerios",
        }
      : null,
  "ministry.update": (a, b, ctx) =>
    can(ctx.role, "ministry:read")
      ? {
          accion: a?.archived
            ? `archivó el ministerio «${a?.name}»`
            : `cambió el plan de «${a?.name}»`,
          detalle: a?.budget ? dinero(a.budget, ctx) : null,
          url: "/ministerios",
        }
      : null,
  "ministry.delete": (a, b, ctx) =>
    can(ctx.role, "ministry:read")
      ? { accion: `borró el ministerio «${b?.name || a?.name || ""}»`, url: "/ministerios" }
      : null,

  //! ── Conteo de ofrenda con doble firma ──
  //! `service` es el nombre del culto ("Culto de domingo"), no una fecha
  "offering.count": (a, b, ctx) => ({
    accion: "hizo el conteo de la ofrenda",
    detalle: lista(a?.service && `«${a.service}»`, dinero(a?.amount, ctx), a?.fund && `fondo ${a.fund}`),
    url: "/conteos",
  }),
  "offering.confirm": (a, b, ctx) => ({
    accion: "firmó un conteo de ofrenda",
    detalle: lista(a?.service && `«${a.service}»`, dinero(a?.amount, ctx)),
    url: "/conteos",
  }),
  "offering.void": (a) => ({
    accion: "descartó un conteo de ofrenda",
    detalle: a?.reason || a?.note || null,
    url: "/conteos",
  }),

  //! ── El espacio y su enlace público: lo ve cualquiera del equipo ──
  "workspace.update": () => ({ accion: "cambió los ajustes del espacio", url: "/espacio/ajustes" }),
  "workspace.logo": () => ({ accion: "cambió el logo del espacio", url: "/espacio/ajustes" }),
  "publicLink.update": (a) => ({
    accion: a?.active
      ? "publicó el enlace para la congregación"
      : "cambió el enlace para la congregación",
    detalle: a?.period ? `periodo ${a.period}` : null,
    url: "/espacio/ajustes",
  }),
  "publicLink.delete": () => ({
    accion: "apagó el enlace para la congregación",
    url: "/espacio/ajustes",
  }),
};

//! Acciones que NO se avisan: son de la plataforma, no del espacio
const SILENCIO = new Set(["workspace.create"]);

//! Un cambio, contado para quien lo mira. Devuelve null si no le corresponde.
const describir = ({ action, before, after, note, role, currency = "USD" }) => {
  if (SILENCIO.has(action)) return null;

  //! Los avisos son del libro del espacio: quien no puede leerlo (el líder de un
  //! ministerio) no recibe nada. Mandarle "alguien se sumó al equipo" para que
  //! no tenga ni campana donde leerlo sería ruido, y su menú es corto a
  //! propósito.
  //! El resto de lo que cada rol puede ver lo deciden las propias acciones: a
  //! quien no ve aportantes se le cuenta sin nombres, y los ministerios solo se
  //! nombran a quien los ve.
  if (!can(role, "tx:read")) return null;

  const contar = CAMBIOS[action];
  const ctx = { role, currency };
  const texto = contar
    ? contar(after || {}, before || {}, ctx)
    : { accion: "hizo un cambio", detalle: null, url: null };

  if (!texto) return null;

  return {
    accion: texto.accion,
    detalle: texto.detalle || (note ? String(note) : null),
    url: texto.url || "/movimientos",
  };
};

//! Desde cuándo cuenta lo que no se ha leído. Un miembro nuevo empieza a contar
//! al entrar; a quien ya estaba se le da un día de gracia, para que el día del
//! estreno nadie abra la campana con 500 avisos de meses atrás.
const desdeCuando = (membership) => {
  if (membership?.lastReadAt) return membership.lastReadAt;
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (membership?.createdAt && membership.createdAt > ayer) return membership.createdAt;
  return ayer;
};

const visible = (entrada, role, currency) =>
  Boolean(describir({ ...entrada, role, currency }));

//! Los avisos del espacio para una persona, del más nuevo al más viejo.
//! Lo que uno mismo hizo no se avisa: ya lo sabe.
const listar = async ({ workspace, userId, role, limit }) => {
  const membership = await Membership.findOne({
    workspace: workspace._id,
    user: userId,
  }).lean();
  const desde = desdeCuando(membership);
  const tope = Math.min(Math.max(Number(limit) || LIMITE, 1), LIMITE_MAX);

  //! Se piden de más porque algunos se descartan al filtrarlos por rol
  const crudos = await AuditLog.find({ workspace: workspace._id, actor: { $ne: userId } })
    .sort({ createdAt: -1 })
    .limit(tope * 2)
    .lean();

  const items = [];
  for (const entrada of crudos) {
    if (items.length >= tope) break;
    const texto = describir({
      ...entrada,
      role,
      currency: workspace.currency,
    });
    if (!texto) continue;
    items.push({
      _id: entrada._id,
      actorName: entrada.actorName,
      entity: entrada.entity,
      createdAt: entrada.createdAt,
      read: entrada.createdAt <= desde,
      ...texto,
    });
  }

  return { items, unread: await contarSinLeer({ workspace, userId, role, desde }) };
};

//! Cuántos avisos sin leer. Se miran como mucho 200 entradas: para el contador
//! de la campana ("9+") no hace falta el número exacto de un año entero.
const contarSinLeer = async ({ workspace, userId, role, desde }) => {
  const crudos = await AuditLog.find({
    workspace: workspace._id,
    actor: { $ne: userId },
    createdAt: { $gt: desde },
  })
    .sort({ createdAt: -1 })
    .limit(TOPE_CONTEO)
    .lean();

  return crudos.filter((entrada) =>
    visible(entrada, role, workspace.currency)
  ).length;
};

//! Marcar como leídos: se apunta hasta cuándo leyó, no cada aviso uno por uno.
const marcarLeidas = ({ workspace, userId }) =>
  Membership.updateOne(
    { workspace: workspace._id, user: userId },
    { lastReadAt: new Date() }
  );

//! Reparte un cambio recién registrado: a cada miembro se le cuenta según su rol
//! y se le manda al teléfono si tiene avisos activados. Nunca lanza.
const avisar = async ({ entrada, workspace, actorName }) => {
  try {
    if (SILENCIO.has(entrada.action)) return 0;

    const miembros = await Membership.find({
      workspace: workspace._id,
      user: { $ne: entrada.actor },
    })
      .select("user role")
      .lean();

    let enviados = 0;
    for (const miembro of miembros) {
      const texto = describir({
        action: entrada.action,
        entity: entrada.entity,
        before: entrada.before,
        after: entrada.after,
        note: entrada.note,
        role: miembro.role,
        currency: workspace.currency,
      });
      if (!texto) continue;

      enviados += await push.enviarA({
        userId: miembro.user,
        payload: {
          title: `${actorName} ${texto.accion}`,
          body: lista(texto.detalle, workspace.name),
          url: texto.url,
          tag: `${entrada.entity}:${entrada.entityId || ""}`,
          workspaceId: String(workspace._id),
        },
      });
    }

    return enviados;
  } catch (err) {
    console.error("[aviso] No se pudieron repartir los avisos:", err.message);
    return 0;
  }
};

module.exports = {
  LIMITE,
  LIMITE_MAX,
  describir,
  listar,
  contarSinLeer,
  marcarLeidas,
  avisar,
  desdeCuando,
};
