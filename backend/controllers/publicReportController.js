const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const PublicReport = require("../model/PublicReport");
const Workspace = require("../model/Workspace");
const { APP_URL } = require("../config/env");
const { audit } = require("../utils/audit");
const { monthlyReport, annualReport } = require("../services/reportService");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

//! El enlace que se comparte. El token solo existe en claro en este momento:
//! en la base se guarda su hash.
const linkFor = (token) => `${APP_URL}/cuentas/${token}`;

//! Lo que se le cuenta al propietario sobre su enlace (nunca el token)
const linkView = (doc) =>
  doc
    ? {
        active: doc.active,
        period: doc.period,
        showFunds: doc.showFunds,
        hint: doc.hint,
        views: doc.views,
        lastViewedAt: doc.lastViewedAt,
        createdAt: doc.createdAt,
      }
    : null;

const parseSettings = (body = {}) => {
  const values = {};
  if (body.period !== undefined) {
    if (!["mes", "anio"].includes(body.period)) return { error: "Periodo inválido" };
    values.period = body.period;
  }
  if (body.showFunds !== undefined) values.showFunds = Boolean(body.showFunds);
  if (body.active !== undefined) values.active = Boolean(body.active);
  return { values };
};

const publicReportController = {
  //! Cómo está el enlace del espacio
  get: asyncHandler(async (req, res) => {
    const link = await PublicReport.findOne({ workspace: req.workspace._id });
    res.json(linkView(link));
  }),

  //! Crear el enlace, o rehacerlo. Al rehacerlo, el anterior deja de servir:
  //! es la forma de cortar el acceso si el enlace se fue a donde no debía.
  create: asyncHandler(async (req, res) => {
    const { values, error } = parseSettings(req.body);
    if (error) return res.status(400).json({ message: error });

    const token = crypto.randomBytes(32).toString("hex");
    const existed = await PublicReport.findOne({ workspace: req.workspace._id });

    const link = await PublicReport.findOneAndUpdate(
      { workspace: req.workspace._id },
      {
        $set: {
          tokenHash: hashToken(token),
          hint: token.slice(-6),
          active: true,
          createdBy: req.user._id,
          //! Un enlace nuevo empieza su cuenta de visitas de cero
          views: 0,
          lastViewedAt: null,
          period: values.period ?? existed?.period ?? "mes",
          showFunds: values.showFunds ?? existed?.showFunds ?? true,
        },
      },
      { upsert: true, new: true }
    );

    await audit(req, {
      action: existed ? "publicLink.renew" : "publicLink.create",
      entity: "publicLink",
      entityId: link._id,
      after: { period: link.period, showFunds: link.showFunds },
    });

    //! El token viaja UNA sola vez: si se pierde, se rehace
    res.status(201).json({ ...linkView(link), url: linkFor(token) });
  }),

  //! Cambiar qué se publica, o apagarlo sin borrarlo
  update: asyncHandler(async (req, res) => {
    const link = await PublicReport.findOne({ workspace: req.workspace._id });
    if (!link) return res.status(404).json({ message: "Este espacio no tiene enlace" });

    const { values, error } = parseSettings(req.body);
    if (error) return res.status(400).json({ message: error });

    const before = { period: link.period, showFunds: link.showFunds, active: link.active };
    Object.assign(link, values);
    await link.save();

    await audit(req, {
      action: "publicLink.update",
      entity: "publicLink",
      entityId: link._id,
      before,
      after: { period: link.period, showFunds: link.showFunds, active: link.active },
    });

    res.json(linkView(link));
  }),

  //! Quitarlo del todo
  remove: asyncHandler(async (req, res) => {
    const link = await PublicReport.findOneAndDelete({ workspace: req.workspace._id });
    if (!link) return res.status(404).json({ message: "Este espacio no tiene enlace" });

    await audit(req, {
      action: "publicLink.delete",
      entity: "publicLink",
      entityId: link._id,
      before: { period: link.period },
    });

    res.json({ message: "El enlace dejó de funcionar" });
  }),

  //! ── La parte pública: sin sesión ──────────────────────────────────────
  //!
  //! Solo totales. Nunca aportantes, comprobantes, detalle de movimientos ni
  //! quién registró qué: quien abre esto es la congregación, no la tesorería.
  show: asyncHandler(async (req, res) => {
    const token = String(req.params.token || "");
    //! Un token que ni siquiera tiene la forma correcta no llega a la base
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(404).json({ message: "Ese enlace no existe o dejó de funcionar" });
    }

    const link = await PublicReport.findOne({ tokenHash: hashToken(token), active: true });
    if (!link) {
      return res.status(404).json({ message: "Ese enlace no existe o dejó de funcionar" });
    }

    const workspace = await Workspace.findById(link.workspace);
    if (!workspace) {
      return res.status(404).json({ message: "Ese enlace no existe o dejó de funcionar" });
    }

    const hoy = new Date();
    const esMes = link.period === "mes";
    const report = esMes
      ? await monthlyReport(workspace._id, hoy.getFullYear(), hoy.getMonth() + 1, workspace.kind === "iglesia")
      : await annualReport(workspace._id, hoy.getFullYear(), workspace.kind === "iglesia");

    //! Se cuenta la visita sin esperar a que termine: que el contador falle no
    //! puede impedir que la congregación vea las cuentas
    PublicReport.updateOne(
      { _id: link._id },
      { $inc: { views: 1 }, $set: { lastViewedAt: new Date() } }
    ).catch(() => {});

    res.json({
      church: workspace.name,
      logo: workspace.logo?.url || "",
      currency: workspace.currency,
      period: link.period,
      year: report.year,
      month: esMes ? report.month : null,
      //! Solo cifras agregadas
      opening: report.opening,
      income: report.income,
      expense: report.expense,
      result: report.result,
      closing: report.closing,
      incomeBreakdown: report.incomeBreakdown,
      expenseBreakdown: report.expenseBreakdown,
      months: esMes ? null : report.months,
      funds: link.showFunds ? report.funds : null,
    });
  }),
};

module.exports = publicReportController;
module.exports.hashToken = hashToken;
