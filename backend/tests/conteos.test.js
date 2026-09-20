const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  app,
  request,
  setupDatabase,
  teardownDatabase,
  clearDatabase,
  createUser,
} = require("./helpers");
const OfferingCount = require("../model/OfferingCount");
const Transaction = require("../model/Transaccion");

const as = (method, url, user, workspaceId) => {
  const req = request(app)[method](url).set("Authorization", `Bearer ${user.token}`);
  return workspaceId ? req.set("X-Workspace-Id", String(workspaceId)) : req;
};

const invitarYAceptar = async (anfitrion, workspaceId, invitado, role) => {
  const inv = await as("post", `/api/v1/workspaces/${workspaceId}/invitations`, anfitrion)
    .send({ email: invitado.credentials.email, role })
    .expect(201);
  const token = inv.body.url.split("/invitacion/")[1];
  await as("post", `/api/v1/invitations/${token}/accept`, invitado).expect(200);
};

//! Una iglesia con su pastor (propietario) y un tesorero: son los dos que
//! cuentan la ofrenda
const iglesiaConDos = async () => {
  const pastor = await createUser({ iglesia: "Iglesia Betel" });
  const ws = pastor.user.defaultWorkspace;
  const tesorero = await createUser();
  await invitarYAceptar(pastor, ws, tesorero, "tesorero");
  return { pastor, tesorero, ws };
};

const contar = (user, ws, body) =>
  as("post", "/api/v1/conteos", user, ws).send({
    date: "2026-09-13",
    service: "Culto del domingo",
    ...body,
  });

describe("Conteo de ofrenda con doble firma", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("el conteo no entra al libro hasta que firma una segunda persona", async () => {
    const { pastor, tesorero, ws } = await iglesiaConDos();

    const creado = await contar(pastor, ws, { amount: 1240.5 }).expect(201);
    assert.equal(creado.body.status, "pendiente");
    assert.equal(creado.body.amount, 1240.5);
    assert.equal(creado.body.countedBy.username, pastor.user.username);
    assert.equal(creado.body.confirmedBy, null);

    //! Todavía no hay movimiento: el dinero está contado, no asentado
    assert.equal(await Transaction.countDocuments({ workspace: ws }), 0);
    const balance = await as("get", "/api/v1/transactions/balance", pastor, ws).expect(200);
    assert.equal(balance.body.income, 0);

    const confirmado = await as(
      "post",
      `/api/v1/conteos/${creado.body._id}/confirmar`,
      tesorero,
      ws
    ).expect(200);
    assert.equal(confirmado.body.status, "confirmado");
    assert.equal(confirmado.body.confirmedBy.username, tesorero.user.username);

    //! Y ahora sí
    const movimientos = await Transaction.find({ workspace: ws });
    assert.equal(movimientos.length, 1);
    assert.equal(movimientos[0].amountCents, 124050);
    assert.equal(movimientos[0].type, "income");
    assert.equal(movimientos[0].category, "ofrendas");
    assert.match(movimientos[0].description, /Culto del domingo/);
  });

  test("quien contó no puede poner también la segunda firma", async () => {
    const { pastor, ws } = await iglesiaConDos();
    const creado = await contar(pastor, ws, { amount: 500 }).expect(201);

    const res = await as("post", `/api/v1/conteos/${creado.body._id}/confirmar`, pastor, ws)
      .expect(409);
    assert.equal(res.body.code, "MISMA_PERSONA");

    assert.equal(await Transaction.countDocuments({ workspace: ws }), 0);
    assert.equal((await OfferingCount.findById(creado.body._id)).status, "pendiente");
  });

  test("el desglose por billetes y monedas suma solo", async () => {
    const { pastor, tesorero, ws } = await iglesiaConDos();

    const creado = await contar(pastor, ws, {
      breakdown: [
        { value: 50, count: 4 },
        { value: 20, count: 3 },
        { value: 0.5, count: 6 },
        //! Las denominaciones que no salieron no se guardan
        { value: 200, count: 0 },
      ],
    }).expect(201);

    assert.equal(creado.body.amount, 263);
    assert.equal(creado.body.breakdown.length, 3);
    assert.deepEqual(creado.body.breakdown[0], { value: 50, count: 4 });

    await as("post", `/api/v1/conteos/${creado.body._id}/confirmar`, tesorero, ws).expect(200);
    assert.equal((await Transaction.findOne({ workspace: ws })).amountCents, 26300);
  });

  test("si el desglose no cuadra con el total escrito, se avisa", async () => {
    const { pastor, ws } = await iglesiaConDos();

    const res = await contar(pastor, ws, {
      amount: 300,
      breakdown: [{ value: 50, count: 4 }],
    }).expect(400);

    assert.equal(res.body.code, "NO_CUADRA");
    assert.match(res.body.message, /200/);
    assert.match(res.body.message, /300/);
    assert.equal(await OfferingCount.countDocuments(), 0);
  });

  test("los datos imposibles se rechazan", async () => {
    const { pastor, ws } = await iglesiaConDos();

    await contar(pastor, ws, { amount: 0 }).expect(400);
    await contar(pastor, ws, { amount: -50 }).expect(400);
    await contar(pastor, ws, { amount: 100, date: "no-es-fecha" }).expect(400);
    await contar(pastor, ws, { amount: 100, service: "  " }).expect(400);
    await contar(pastor, ws, { breakdown: [{ value: 50, count: 1.5 }] }).expect(400);
    await contar(pastor, ws, { breakdown: [{ value: -1, count: 2 }] }).expect(400);
    await contar(pastor, ws, { amount: 100, fund: "no-es-un-id" }).expect(400);

    assert.equal(await OfferingCount.countDocuments(), 0);
  });

  test("el conteo puede ir a un fondo concreto", async () => {
    const { pastor, tesorero, ws } = await iglesiaConDos();
    const fondo = (await as("post", "/api/v1/funds", pastor, ws).send({ name: "Misiones" }).expect(201)).body;

    const creado = await contar(pastor, ws, {
      amount: 300,
      fund: fondo._id,
      service: "Domingo misionero",
      category: "ofrenda misionera",
    }).expect(201);
    assert.equal(creado.body.fund.name, "Misiones");

    await as("post", `/api/v1/conteos/${creado.body._id}/confirmar`, tesorero, ws).expect(200);

    const fondos = (await as("get", "/api/v1/funds", pastor, ws).expect(200)).body;
    assert.equal(fondos.find((f) => f.name === "Misiones").balance, 300);
    assert.equal((await Transaction.findOne({ workspace: ws })).category, "ofrenda misionera");
  });

  test("un conteo pendiente se descarta con motivo; uno confirmado ya no", async () => {
    const { pastor, tesorero, ws } = await iglesiaConDos();
    const creado = await contar(pastor, ws, { amount: 100 }).expect(201);

    //! Sin motivo no se descarta
    await as("post", `/api/v1/conteos/${creado.body._id}/anular`, pastor, ws)
      .send({ reason: "" })
      .expect(400);

    const anulado = await as("post", `/api/v1/conteos/${creado.body._id}/anular`, pastor, ws)
      .send({ reason: "Se contó dos veces" })
      .expect(200);
    assert.equal(anulado.body.status, "anulado");
    assert.equal(anulado.body.voidReason, "Se contó dos veces");

    //! Ya anulado, no se puede firmar
    await as("post", `/api/v1/conteos/${creado.body._id}/confirmar`, tesorero, ws).expect(409);

    //! Y uno confirmado no se descarta desde aquí: se anula su movimiento
    const otro = await contar(pastor, ws, { amount: 80 }).expect(201);
    await as("post", `/api/v1/conteos/${otro.body._id}/confirmar`, tesorero, ws).expect(200);
    const res = await as("post", `/api/v1/conteos/${otro.body._id}/anular`, pastor, ws)
      .send({ reason: "me equivoqué" })
      .expect(409);
    assert.equal(res.body.code, "YA_CONFIRMADO");
  });

  test("no se puede confirmar dos veces ni tocar el conteo de otra iglesia", async () => {
    const { pastor, tesorero, ws } = await iglesiaConDos();
    const otra = await iglesiaConDos();

    const creado = await contar(pastor, ws, { amount: 100 }).expect(201);
    await as("post", `/api/v1/conteos/${creado.body._id}/confirmar`, tesorero, ws).expect(200);
    await as("post", `/api/v1/conteos/${creado.body._id}/confirmar`, tesorero, ws).expect(409);
    assert.equal(await Transaction.countDocuments({ workspace: ws }), 1);

    //! Desde otra iglesia no existe
    await as("post", `/api/v1/conteos/${creado.body._id}/confirmar`, otra.pastor, otra.ws).expect(404);
  });

  test("un auditor ve los conteos pero no cuenta ni firma", async () => {
    const { pastor, tesorero, ws } = await iglesiaConDos();
    const auditor = await createUser();
    await invitarYAceptar(pastor, ws, auditor, "auditor");

    const creado = await contar(pastor, ws, { amount: 100 }).expect(201);

    const lista = await as("get", "/api/v1/conteos", auditor, ws).expect(200);
    assert.equal(lista.body.counts.length, 1);
    assert.equal(lista.body.counts[0].amount, 100);

    await contar(auditor, ws, { amount: 50 }).expect(403);
    await as("post", `/api/v1/conteos/${creado.body._id}/confirmar`, auditor, ws).expect(403);

    //! El tesorero sí
    await as("post", `/api/v1/conteos/${creado.body._id}/confirmar`, tesorero, ws).expect(200);
  });

  test("la lista pone primero los que esperan segunda firma", async () => {
    const { pastor, tesorero, ws } = await iglesiaConDos();

    const viejo = await contar(pastor, ws, { amount: 100, date: "2026-09-06" }).expect(201);
    await as("post", `/api/v1/conteos/${viejo.body._id}/confirmar`, tesorero, ws).expect(200);
    await contar(pastor, ws, { amount: 200, date: "2026-08-30" }).expect(201);

    const lista = await as("get", "/api/v1/conteos", pastor, ws).expect(200);
    //! El pendiente es más viejo, pero va primero: es lo que hay que hacer
    assert.equal(lista.body.counts[0].status, "pendiente");
    assert.equal(lista.body.counts[0].amount, 200);
    assert.equal(lista.body.counts[1].status, "confirmado");
    assert.equal(lista.body.me, String(pastor.user._id || pastor.user.id));
  });

  test("borrar el espacio se lleva sus conteos", async () => {
    const { pastor, ws } = await iglesiaConDos();
    await contar(pastor, ws, { amount: 100 }).expect(201);

    const workspaces = (await as("get", "/api/v1/workspaces", pastor).expect(200)).body;
    const nombre = workspaces.find((w) => String(w._id) === String(ws)).name;
    await as("delete", `/api/v1/workspaces/${ws}`, pastor).send({ confirmName: nombre }).expect(200);

    assert.equal(await OfferingCount.countDocuments({ workspace: ws }), 0);
  });

  test("las dos firmas quedan en el historial", async () => {
    const { pastor, tesorero, ws } = await iglesiaConDos();
    const creado = await contar(pastor, ws, { amount: 450 }).expect(201);
    await as("post", `/api/v1/conteos/${creado.body._id}/confirmar`, tesorero, ws).expect(200);

    const historial = (await as("get", `/api/v1/workspaces/${ws}/audit`, pastor).expect(200)).body
      .entries;
    const conteo = historial.find((e) => e.action === "offering.count");
    const firma = historial.find((e) => e.action === "offering.confirm");

    assert.equal(conteo.after.service, "Culto del domingo");
    assert.equal(conteo.actorName, pastor.user.username);
    assert.equal(firma.actorName, tesorero.user.username);
  });
});
