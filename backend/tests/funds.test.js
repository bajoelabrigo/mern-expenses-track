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

//! Pastor con su iglesia (espacio predeterminado)
const iglesia = async () => {
  const pastor = await createUser({ iglesia: "Iglesia Betel" });
  return { pastor, ws: pastor.user.defaultWorkspace };
};

const crearFondo = (user, ws, body) => as("post", "/api/v1/funds", user, ws).send(body);
const fondos = async (user, ws) => (await as("get", "/api/v1/funds", user, ws).expect(200)).body;
const movimiento = (user, ws, body) =>
  as("post", "/api/v1/transactions/create", user, ws).send({
    type: "income",
    category: "ofrendas",
    date: "2026-03-10",
    ...body,
  });
const pase = (user, ws, body) => as("post", "/api/v1/funds/transfers", user, ws).send(body);
const saldoDe = (lista, nombre) => lista.find((f) => f.name === nombre).balance;

describe("Fondos", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("el General va primero; los nombres no se repiten y 'General' está reservado", async () => {
    const { pastor, ws } = await iglesia();

    const creado = await crearFondo(pastor, ws, { name: "  Misiones ", icon: "🌍", goal: 5000 }).expect(201);
    assert.equal(creado.body.name, "Misiones");
    assert.equal(creado.body.goal, 5000);
    assert.equal(creado.body.balance, 0);

    await crearFondo(pastor, ws, { name: "misiones" }).expect(409);
    await crearFondo(pastor, ws, { name: "general" }).expect(400);
    await crearFondo(pastor, ws, { name: "" }).expect(400);
    await crearFondo(pastor, ws, { name: "Construcción", goal: -3 }).expect(400);

    const lista = await fondos(pastor, ws);
    assert.deepEqual(lista.map((f) => f.name), ["General", "Misiones"]);
    assert.equal(lista[0].general, true);
    assert.equal(lista[0]._id, null);
  });

  test("cada movimiento suma en su fondo; sin fondo va al General", async () => {
    const { pastor, ws } = await iglesia();
    const misiones = (await crearFondo(pastor, ws, { name: "Misiones" }).expect(201)).body;

    await movimiento(pastor, ws, { amount: 1000 }).expect(201);
    await movimiento(pastor, ws, { amount: 300, fund: misiones._id }).expect(201);
    await movimiento(pastor, ws, { type: "expense", category: "pasajes", amount: 120.5, fund: misiones._id }).expect(201);

    const lista = await fondos(pastor, ws);
    assert.equal(saldoDe(lista, "General"), 1000);
    assert.equal(saldoDe(lista, "Misiones"), 179.5);

    //! Filtro por fondo en el listado, con el nombre del fondo incluido
    const deMisiones = await as("get", `/api/v1/transactions/lists?fund=${misiones._id}`, pastor, ws).expect(200);
    assert.equal(deMisiones.body.total, 2);
    assert.equal(deMisiones.body.transactions[0].fund.name, "Misiones");
    const delGeneral = await as("get", "/api/v1/transactions/lists?fund=general", pastor, ws).expect(200);
    assert.equal(delGeneral.body.total, 1);
    await as("get", "/api/v1/transactions/lists?fund=nada", pastor, ws).expect(400);

    //! Mover un movimiento al General desde la edición
    const id = deMisiones.body.transactions.find((t) => t.type === "income")._id;
    await as("put", `/api/v1/transactions/update/${id}`, pastor, ws).send({ fund: null }).expect(200);
    assert.equal(saldoDe(await fondos(pastor, ws), "Misiones"), -120.5);
  });

  test("el saldo de un fondo no cuenta lo que todavía no pasó", async () => {
    const { pastor, ws } = await iglesia();
    const misiones = (await crearFondo(pastor, ws, { name: "Misiones", goal: 1000 }).expect(201)).body;
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await movimiento(pastor, ws, { amount: 100, fund: misiones._id, date: ayer }).expect(201);
    await movimiento(pastor, ws, { amount: 400, fund: misiones._id, date: manana }).expect(201);
    await pase(pastor, ws, { from: null, to: misiones._id, amount: 50, date: manana }).expect(201);

    const fondo = (await fondos(pastor, ws)).find((f) => f.name === "Misiones");
    assert.equal(fondo.balance, 100);
    assert.equal(fondo.raised, 100, "la meta avanza con lo ya recibido");
  });

  test("no se puede usar un fondo de otro espacio", async () => {
    const { pastor, ws } = await iglesia();
    const otro = await iglesia();
    const ajeno = (await crearFondo(otro.pastor, otro.ws, { name: "Ajeno" }).expect(201)).body;

    await movimiento(pastor, ws, { amount: 10, fund: ajeno._id }).expect(404);
    await movimiento(pastor, ws, { amount: 10, fund: "no-es-un-id" }).expect(400);
    await pase(pastor, ws, { from: null, to: ajeno._id, amount: 5 }).expect(404);
  });

  test("un pase mueve saldo entre fondos sin cambiar el total del espacio", async () => {
    const { pastor, ws } = await iglesia();
    const templo = (await crearFondo(pastor, ws, { name: "Construcción", goal: 1000 }).expect(201)).body;
    await movimiento(pastor, ws, { amount: 2000 }).expect(201);
    await movimiento(pastor, ws, { amount: 150, fund: templo._id }).expect(201);

    const balanceAntes = (await as("get", "/api/v1/transactions/balance", pastor, ws).expect(200)).body;

    const creado = await pase(pastor, ws, { from: "general", to: templo._id, amount: 500, date: "2026-03-12", note: "Acuerdo de junta" }).expect(201);
    assert.equal(creado.body.amount, 500);
    assert.equal(creado.body.to.name, "Construcción");
    assert.equal(creado.body.from, null);

    let lista = await fondos(pastor, ws);
    assert.equal(saldoDe(lista, "General"), 1500);
    const fondoTemplo = lista.find((f) => f.name === "Construcción");
    assert.equal(fondoTemplo.balance, 650);
    //! Lo juntado para la meta cuenta ingresos y pases recibidos
    assert.equal(fondoTemplo.raised, 650);

    const balanceDespues = (await as("get", "/api/v1/transactions/balance", pastor, ws).expect(200)).body;
    assert.deepEqual(balanceDespues, balanceAntes);

    await pase(pastor, ws, { from: templo._id, to: templo._id, amount: 1 }).expect(400);
    await pase(pastor, ws, { to: templo._id, amount: 1 }).expect(400);
    await pase(pastor, ws, { from: null, to: templo._id, amount: 0 }).expect(400);

    const historial = await as("get", `/api/v1/funds/transfers?fund=${templo._id}`, pastor, ws).expect(200);
    assert.equal(historial.body.length, 1);

    //! Anular el pase lo deja a la vista pero deja de contar
    const url = `/api/v1/funds/transfers/${creado.body._id}/void`;
    await as("post", url, pastor, ws).send({ reason: "" }).expect(400);
    await as("post", url, pastor, ws).send({ reason: "Se registró dos veces" }).expect(200);
    await as("post", url, pastor, ws).send({ reason: "otra vez" }).expect(409);
    lista = await fondos(pastor, ws);
    assert.equal(saldoDe(lista, "General"), 2000);
    assert.equal(saldoDe(lista, "Construcción"), 150);
  });

  test("un fondo usado no se borra, se archiva; archivado no recibe movimientos nuevos", async () => {
    const { pastor, ws } = await iglesia();
    const vacio = (await crearFondo(pastor, ws, { name: "Vacío" }).expect(201)).body;
    await as("delete", `/api/v1/funds/${vacio._id}`, pastor, ws).expect(200);

    const jovenes = (await crearFondo(pastor, ws, { name: "Jóvenes" }).expect(201)).body;
    const tx = (await movimiento(pastor, ws, { amount: 80, fund: jovenes._id }).expect(201)).body[0];

    const borrar = await as("delete", `/api/v1/funds/${jovenes._id}`, pastor, ws).expect(409);
    assert.equal(borrar.body.code, "FUND_IN_USE");

    const archivado = await as("put", `/api/v1/funds/${jovenes._id}`, pastor, ws).send({ archived: true }).expect(200);
    assert.equal(archivado.body.archived, true);
    assert.equal(archivado.body.balance, 80);

    await movimiento(pastor, ws, { amount: 5, fund: jovenes._id }).expect(409);
    await pase(pastor, ws, { from: null, to: jovenes._id, amount: 5 }).expect(409);
    //! Lo que queda en un archivado sí se puede sacar
    await pase(pastor, ws, { from: jovenes._id, to: null, amount: 80 }).expect(201);
    //! Y un movimiento viejo de ese fondo se sigue pudiendo corregir
    await as("put", `/api/v1/transactions/update/${tx._id}`, pastor, ws)
      .send({ amount: 90, fund: jovenes._id })
      .expect(200);

    //! Archivados al final de la lista
    const nuevo = (await crearFondo(pastor, ws, { name: "Alabanza" }).expect(201)).body;
    const lista = await fondos(pastor, ws);
    assert.deepEqual(lista.map((f) => f.name), ["General", "Alabanza", "Jóvenes"]);
    assert.equal(nuevo.archived, false);
  });

  test("el contador registra en un fondo pero no crea fondos ni pasa dinero", async () => {
    const { pastor, ws } = await iglesia();
    const contador = await createUser();
    await invitarYAceptar(pastor, ws, contador, "contador");
    const misiones = (await crearFondo(pastor, ws, { name: "Misiones" }).expect(201)).body;

    await crearFondo(contador, ws, { name: "Otro" }).expect(403);
    await pase(contador, ws, { from: null, to: misiones._id, amount: 10 }).expect(403);
    await as("put", `/api/v1/funds/${misiones._id}`, contador, ws).send({ name: "X" }).expect(403);
    await movimiento(contador, ws, { amount: 25, fund: misiones._id }).expect(201);

    const lista = await fondos(contador, ws);
    assert.equal(saldoDe(lista, "Misiones"), 25);
  });

  test("el historial nombra el fondo del movimiento y los cambios de fondos", async () => {
    const { pastor, ws } = await iglesia();
    const misiones = (await crearFondo(pastor, ws, { name: "Misiones" }).expect(201)).body;
    const tx = (await movimiento(pastor, ws, { amount: 40, fund: misiones._id }).expect(201)).body[0];
    await as("put", `/api/v1/transactions/update/${tx._id}`, pastor, ws).send({ fund: "general" }).expect(200);
    await pase(pastor, ws, { from: null, to: misiones._id, amount: 10 }).expect(201);
    await movimiento(pastor, ws, { amount: 5, description: "sin fondo" }).expect(201);

    const audit = (await as("get", `/api/v1/workspaces/${ws}/audit`, pastor).expect(200)).body.entries;
    //! Un movimiento del General no anota el fondo (sería ruido en cada entrada)
    const sinFondo = audit.find((e) => e.action === "transaction.create" && e.after.description === "sin fondo");
    assert.equal(sinFondo.after.fund, undefined);
    const edicion = audit.find((e) => e.action === "transaction.update");
    assert.equal(edicion.before.fund, "Misiones");
    assert.equal(edicion.after.fund, "General");
    const alta = audit.find((e) => e.action === "transaction.create" && e.after.description !== "sin fondo");
    assert.equal(alta.after.fund, "Misiones");
    assert.ok(audit.some((e) => e.action === "fund.create"));
    assert.equal(audit.find((e) => e.action === "fund.transfer").after.to, "Misiones");
  });

  test("borrar el espacio borra sus fondos y pases", async () => {
    const { pastor, ws } = await iglesia();
    await crearFondo(pastor, ws, { name: "Misiones" }).expect(201);
    await pase(pastor, ws, { from: null, to: (await fondos(pastor, ws))[1]._id, amount: 3 }).expect(201);

    const workspaces = (await as("get", "/api/v1/workspaces", pastor).expect(200)).body;
    const nombre = workspaces.find((w) => String(w._id) === String(ws)).name;
    await as("delete", `/api/v1/workspaces/${ws}`, pastor).send({ confirmName: nombre }).expect(200);

    const Fund = require("../model/Fund");
    const FundTransfer = require("../model/FundTransfer");
    assert.equal(await Fund.countDocuments({ workspace: ws }), 0);
    assert.equal(await FundTransfer.countDocuments({ workspace: ws }), 0);
  });
});
