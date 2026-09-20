const asyncHandler = require("express-async-handler");
const OfferingCount = require("../model/OfferingCount");
const Transaction = require("../model/Transaccion");
const { toCents, fromCents } = require("../utils/money");
const { parseTransactionDate } = require("../utils/dates");
const { audit } = require("../utils/audit");
const { resolveFund, fundName } = require("../services/fundService");

const MAX_CENTS = 100_000_000_000;

//! Lee el desglose por denominación: [{ value, count }]. Devuelve los totales
//! en centavos, o un error si algo no es un número razonable.
const parseBreakdown = (rows) => {
  if (rows === undefined || rows === null) return { breakdown: [], cents: null };
  if (!Array.isArray(rows)) return { error: "El desglose debe ser una lista" };

  const breakdown = [];
  let cents = 0;

  for (const row of rows) {
    const valueCents = toCents(row?.value);
    const count = Number(row?.count);
    if (valueCents === null || valueCents < 1) {
      return { error: "Cada denominación debe tener un valor válido" };
    }
    if (!Number.isInteger(count) || count < 0 || count > 100000) {
      return { error: "La cantidad de cada denominación debe ser un número entero" };
    }
    //! Las filas en cero no se guardan: son las que quedaron sin usar
    if (count === 0) continue;
    breakdown.push({ valueCents, count });
    cents += valueCents * count;
  }

  return { breakdown, cents: breakdown.length > 0 ? cents : null };
};

//! El conteo de este espacio por :id (nunca de otro)
const findInWorkspace = (req) =>
  OfferingCount.findOne({ _id: req.params.id, workspace: req.workspace._id });

const withNames = (query) =>
  query
    .populate("countedBy", "username")
    .populate("confirmedBy", "username")
    .populate("fund", "name");

const offeringCountController = {
  //! Los conteos del espacio: primero los que esperan segunda firma
  list: asyncHandler(async (req, res) => {
    const counts = await withNames(
      OfferingCount.find({ workspace: req.workspace._id }).sort({ date: -1, createdAt: -1 }).limit(60)
    );

    const pendientes = counts.filter((c) => c.status === "pendiente");
    const resto = counts.filter((c) => c.status !== "pendiente");

    res.json({
      //! Quién soy, para que la pantalla sepa si puede firmar cada uno
      me: String(req.user._id),
      counts: [...pendientes, ...resto].map((c) => c.toJSON()),
    });
  }),

  //! Primera firma: se cuenta y queda esperando a que otro lo confirme
  create: asyncHandler(async (req, res) => {
    const { date, service, amount, breakdown, category, fund, note } = req.body || {};

    const fecha = parseTransactionDate(date);
    if (!fecha) return res.status(400).json({ message: "Fecha inválida" });

    const culto = String(service || "").trim();
    if (!culto) return res.status(400).json({ message: "Di de qué culto es la ofrenda" });
    if (culto.length > 80) {
      return res.status(400).json({ message: "El nombre del culto es demasiado largo" });
    }

    const desglose = parseBreakdown(breakdown);
    if (desglose.error) return res.status(400).json({ message: desglose.error });

    //! El total sale del desglose si lo hay; si no, del monto que se escribió
    let cents = desglose.cents;
    if (cents === null) {
      cents = toCents(amount);
      if (cents === null || cents < 1) {
        return res.status(400).json({ message: "El monto contado debe ser mayor que cero" });
      }
    }
    if (cents > MAX_CENTS) return res.status(400).json({ message: "El monto es demasiado grande" });

    //! Si se mandan las dos cosas y no cuadran, se avisa en vez de elegir por
    //! el usuario: en un conteo, un descuadre es justo lo que hay que mirar
    if (desglose.cents !== null && amount !== undefined && amount !== null && amount !== "") {
      const escrito = toCents(amount);
      if (escrito !== null && escrito !== desglose.cents) {
        return res.status(400).json({
          message: `El desglose suma ${fromCents(desglose.cents)} y escribiste ${fromCents(escrito)}`,
          code: "NO_CUADRA",
        });
      }
    }

    const resolved = await resolveFund(req.workspace._id, fund);
    if (resolved.error) return res.status(resolved.status).json({ message: resolved.error });

    const count = await OfferingCount.create({
      workspace: req.workspace._id,
      date: fecha,
      service: culto,
      breakdown: desglose.breakdown,
      amountCents: cents,
      category: category ? String(category).trim().toLowerCase() : "ofrendas",
      fund: resolved.fund ? resolved.fund._id : null,
      note: String(note || "").trim().slice(0, 300),
      countedBy: req.user._id,
    });

    await audit(req, {
      action: "offering.count",
      entity: "offeringCount",
      entityId: count._id,
      after: {
        service: count.service,
        amount: count.amount,
        fund: fundName(resolved.fund),
      },
    });

    res.status(201).json((await withNames(OfferingCount.findById(count._id))).toJSON());
  }),

  //! Segunda firma: la confirma otra persona y recién ahí entra al libro
  confirm: asyncHandler(async (req, res) => {
    const count = await findInWorkspace(req);
    if (!count) return res.status(404).json({ message: "Ese conteo no existe" });

    if (count.status === "confirmado") {
      return res.status(409).json({ message: "Ese conteo ya está confirmado" });
    }
    if (count.status === "anulado") {
      return res.status(409).json({ message: "Ese conteo está anulado" });
    }

    //! El control entero se basa en esto: la segunda firma es de OTRA persona
    if (String(count.countedBy) === String(req.user._id)) {
      return res.status(409).json({
        message: "La segunda firma tiene que ser de otra persona",
        code: "MISMA_PERSONA",
      });
    }

    const [transaction] = await Transaction.create([
      {
        workspace: count.workspace,
        createdBy: req.user._id,
        type: "income",
        category: count.category,
        fund: count.fund,
        amountCents: count.amountCents,
        date: count.date,
        description: `${count.service} (conteo con doble firma)`,
      },
    ]);

    count.transaction = transaction._id;
    count.confirmedBy = req.user._id;
    count.confirmedAt = new Date();
    count.status = "confirmado";
    await count.save();

    await audit(req, {
      action: "offering.confirm",
      entity: "offeringCount",
      entityId: count._id,
      after: { service: count.service, amount: count.amount },
    });

    res.json((await withNames(OfferingCount.findById(count._id))).toJSON());
  }),

  //! Descartar un conteo que todavía no entró al libro
  void: asyncHandler(async (req, res) => {
    const count = await findInWorkspace(req);
    if (!count) return res.status(404).json({ message: "Ese conteo no existe" });

    if (count.status === "confirmado") {
      return res.status(409).json({
        message: "Ese conteo ya entró al libro: anula el movimiento en Movimientos",
        code: "YA_CONFIRMADO",
      });
    }
    if (count.status === "anulado") {
      return res.status(409).json({ message: "Ese conteo ya está anulado" });
    }

    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "Di por qué se descarta el conteo" });

    count.status = "anulado";
    count.voidReason = reason.slice(0, 300);
    count.voidedAt = new Date();
    count.voidedBy = req.user._id;
    await count.save();

    await audit(req, {
      action: "offering.void",
      entity: "offeringCount",
      entityId: count._id,
      before: { service: count.service, amount: count.amount },
      after: { reason: count.voidReason },
    });

    res.json((await withNames(OfferingCount.findById(count._id))).toJSON());
  }),
};

module.exports = offeringCountController;
module.exports.parseBreakdown = parseBreakdown;
