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

const iglesia = async () => {
  const pastor = await createUser({ iglesia: "Iglesia Betel" });
  return { pastor, ws: pastor.user.defaultWorkspace };
};

const crearAportante = (user, ws, body) => as("post", "/api/v1/donors", user, ws).send(body);
const aportantes = async (user, ws, query = "") =>
  (await as("get", `/api/v1/donors${query}`, user, ws).expect(200)).body;
const ingreso = (user, ws, body) =>
  as("post", "/api/v1/transactions/create", user, ws).send({
    type: "income",
    category: "diezmos",
    date: "2026-05-10",
    ...body,
  });

describe("Aportantes", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("suma lo que dio cada uno en el año y no repite a la misma persona", async () => {
    const { pastor, ws } = await iglesia();
    const marta = (await crearAportante(pastor, ws, { name: " Marta  Quispe ", document: "12345678" }).expect(201)).body;
    await crearAportante(pastor, ws, { name: "marta quispe" }).expect(409);
    const jorge = (await crearAportante(pastor, ws, { name: "Jorge Ríos" }).expect(201)).body;

    assert.equal(marta.name, "Marta Quispe");
    assert.equal(marta.given, 0);

    await ingreso(pastor, ws, { amount: 200, donor: marta._id }).expect(201);
    await ingreso(pastor, ws, { amount: 150.5, donor: marta._id, date: "2026-08-03" }).expect(201);
    await ingreso(pastor, ws, { amount: 90, donor: jorge._id }).expect(201);
    //! De otro año y una ofrenda sin nombre: no entran en el total de 2026
    await ingreso(pastor, ws, { amount: 500, donor: marta._id, date: "2025-05-10" }).expect(201);
    await ingreso(pastor, ws, { amount: 40 }).expect(201);

    const { year, donors } = await aportantes(pastor, ws);
    assert.equal(year, new Date().getFullYear());
    const de2026 = await aportantes(pastor, ws, "?year=2026");
    const porNombre = Object.fromEntries(de2026.donors.map((d) => [d.name, d.given]));
    assert.deepEqual(porNombre, { "Jorge Ríos": 90, "Marta Quispe": 350.5 });
    assert.equal(de2026.donors.find((d) => d.name === "Marta Quispe").gifts, 2);
    assert.equal(donors.length, 2);

    const detalle = (await as("get", `/api/v1/donors/${marta._id}?year=2026`, pastor, ws).expect(200)).body;
    assert.equal(detalle.given, 350.5);
    assert.equal(detalle.givenAllTime, 850.5);
    await as("get", `/api/v1/donors/${marta._id}?year=abc`, pastor, ws).expect(400);
  });

  test("quién dio cuánto solo lo ve la tesorería", async () => {
    const { pastor, ws } = await iglesia();
    const contador = await createUser();
    const auditor = await createUser();
    await invitarYAceptar(pastor, ws, contador, "contador");
    await invitarYAceptar(pastor, ws, auditor, "auditor");

    const marta = (await crearAportante(pastor, ws, { name: "Marta" }).expect(201)).body;
    const tx = (await ingreso(pastor, ws, { amount: 200, donor: marta._id }).expect(201)).body[0];

    //! El contador registra y ve los aportes
    const delContador = await as("get", "/api/v1/transactions/lists", contador, ws).expect(200);
    assert.equal(delContador.body.transactions[0].donor.name, "Marta");
    await as("get", "/api/v1/donors", contador, ws).expect(200);

    //! El auditor ve el movimiento, pero sin el aportante
    const delAuditor = await as("get", "/api/v1/transactions/lists", auditor, ws).expect(200);
    assert.equal(delAuditor.body.transactions[0].amount, 200);
    assert.equal(delAuditor.body.transactions[0].donor, undefined);
    const unoAuditor = await as("get", `/api/v1/transactions/${tx._id}`, auditor, ws).expect(200);
    assert.equal(unoAuditor.body.donor, undefined);
    const periodoAuditor = await as(
      "get",
      "/api/v1/transactions/period?startDate=2026-01-01&endDate=2026-12-31",
      auditor,
      ws
    ).expect(200);
    assert.equal(periodoAuditor.body[0].donor, undefined);

    //! Y no entra a la lista de aportantes ni puede crear uno
    await as("get", "/api/v1/donors", auditor, ws).expect(403);
    await crearAportante(auditor, ws, { name: "Otro" }).expect(403);

    //! Tampoco ve en el historial lo que pasó con los aportantes
    const auditoria = await as("get", `/api/v1/workspaces/${ws}/audit`, auditor).expect(200);
    assert.ok(!auditoria.body.entries.some((e) => e.entity === "donor"));
    const auditoriaPastor = await as("get", `/api/v1/workspaces/${ws}/audit`, pastor).expect(200);
    assert.ok(auditoriaPastor.body.entries.some((e) => e.action === "donor.create"));
  });

  test("el aportante es de ingresos y de este espacio", async () => {
    const { pastor, ws } = await iglesia();
    const otra = await iglesia();
    const ajeno = (await crearAportante(otra.pastor, otra.ws, { name: "Ajena" }).expect(201)).body;
    const marta = (await crearAportante(pastor, ws, { name: "Marta" }).expect(201)).body;

    await ingreso(pastor, ws, { amount: 10, donor: ajeno._id }).expect(404);
    await ingreso(pastor, ws, { amount: 10, donor: "no-es-id" }).expect(400);
    await ingreso(pastor, ws, { type: "expense", category: "luz", amount: 10, donor: marta._id }).expect(400);

    //! Al pasar un ingreso a gasto se le quita el aportante
    const tx = (await ingreso(pastor, ws, { amount: 30, donor: marta._id }).expect(201)).body[0];
    const editada = await as("put", `/api/v1/transactions/update/${tx._id}`, pastor, ws)
      .send({ type: "expense", category: "luz" })
      .expect(200);
    assert.equal(editada.body.donor, null);
  });

  test("se filtra por aportante y quien ya dio se archiva en vez de borrarse", async () => {
    const { pastor, ws } = await iglesia();
    const marta = (await crearAportante(pastor, ws, { name: "Marta" }).expect(201)).body;
    const nuevo = (await crearAportante(pastor, ws, { name: "Sin aportes" }).expect(201)).body;
    await ingreso(pastor, ws, { amount: 200, donor: marta._id }).expect(201);
    await ingreso(pastor, ws, { amount: 40 }).expect(201);

    const suyos = await as("get", `/api/v1/transactions/lists?donor=${marta._id}`, pastor, ws).expect(200);
    assert.equal(suyos.body.total, 1);
    const anonimos = await as("get", "/api/v1/transactions/lists?donor=sin", pastor, ws).expect(200);
    assert.equal(anonimos.body.total, 1);

    //! Quien no dio nada se puede borrar; quien ya dio, no
    await as("delete", `/api/v1/donors/${nuevo._id}`, pastor, ws).expect(200);
    const enUso = await as("delete", `/api/v1/donors/${marta._id}`, pastor, ws).expect(409);
    assert.equal(enUso.body.code, "DONOR_IN_USE");

    const archivada = await as("put", `/api/v1/donors/${marta._id}`, pastor, ws)
      .send({ archived: true, phone: "999 111 222" })
      .expect(200);
    assert.equal(archivada.body.archived, true);
    assert.equal(archivada.body.phone, "999 111 222");
  });

  test("borrar el espacio borra sus aportantes", async () => {
    const { pastor, ws } = await iglesia();
    await crearAportante(pastor, ws, { name: "Marta" }).expect(201);

    const workspaces = (await as("get", "/api/v1/workspaces", pastor).expect(200)).body;
    const nombre = workspaces.find((w) => String(w._id) === String(ws)).name;
    await as("delete", `/api/v1/workspaces/${ws}`, pastor).send({ confirmName: nombre }).expect(200);

    const Donor = require("../model/Donor");
    assert.equal(await Donor.countDocuments({ workspace: ws }), 0);
  });
});
