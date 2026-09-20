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
const Ministry = require("../model/Ministry");

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

const AÑO = 2026;

const crearMinisterio = (user, ws, body) =>
  as("post", "/api/v1/ministerios", user, ws).send({ year: AÑO, budget: 3000, ...body });

const gasto = (user, ws, body) =>
  as("post", "/api/v1/transactions/create", user, ws).send({
    type: "expense",
    category: "actividades",
    date: `${AÑO}-03-10`,
    ...body,
  });

const listar = async (user, ws, year = AÑO) =>
  (await as("get", `/api/v1/ministerios?year=${year}`, user, ws).expect(200)).body;

describe("Presupuesto por ministerio", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("el presupuesto avisa al 80 % y cuando se pasa", async () => {
    const { pastor, ws } = await iglesia();
    const jovenes = (await crearMinisterio(pastor, ws, { name: "Jóvenes", budget: 1000 }).expect(201)).body;

    //! Al principio, ni aviso ni nada gastado
    let m = (await listar(pastor, ws)).ministries[0];
    assert.equal(m.spent, 0);
    assert.equal(m.remaining, 1000);
    assert.equal(m.percent, 0);
    assert.equal(m.warning, false);
    assert.equal(m.exceeded, false);

    //! La mitad: todavía tranquilo
    await gasto(pastor, ws, { amount: 500, ministry: jovenes._id }).expect(201);
    m = (await listar(pastor, ws)).ministries[0];
    assert.equal(m.spent, 500);
    assert.equal(m.percent, 50);
    assert.equal(m.warning, false);

    //! 850 de 1000: hay que mirar
    await gasto(pastor, ws, { amount: 350, ministry: jovenes._id }).expect(201);
    m = (await listar(pastor, ws)).ministries[0];
    assert.equal(m.percent, 85);
    assert.equal(m.warning, true);
    assert.equal(m.exceeded, false);
    assert.equal(m.remaining, 150);

    //! Pasado: se avisa, pero NO se bloquea (la iglesia decide, no la app)
    await gasto(pastor, ws, { amount: 300, ministry: jovenes._id }).expect(201);
    m = (await listar(pastor, ws)).ministries[0];
    assert.equal(m.spent, 1150);
    assert.equal(m.percent, 115);
    assert.equal(m.exceeded, true);
    assert.equal(m.remaining, -150);
  });

  test("solo los gastos se cargan a un ministerio, y solo del año que toca", async () => {
    const { pastor, ws } = await iglesia();
    const jovenes = (await crearMinisterio(pastor, ws, { name: "Jóvenes" }).expect(201)).body;

    //! Un ingreso no se carga a un presupuesto de gasto
    await as("post", "/api/v1/transactions/create", pastor, ws)
      .send({ type: "income", category: "ofrendas", amount: 100, date: `${AÑO}-03-10`, ministry: jovenes._id })
      .expect(400);

    //! De otro año: no cuenta contra este presupuesto
    await gasto(pastor, ws, { amount: 200, ministry: jovenes._id, date: "2025-03-10" }).expect(201);
    await gasto(pastor, ws, { amount: 300, ministry: jovenes._id }).expect(201);

    assert.equal((await listar(pastor, ws)).ministries[0].spent, 300);
  });

  test("lo anulado y lo que todavía no pasó no gastan presupuesto", async () => {
    const { pastor, ws } = await iglesia();
    const hoy = new Date();
    const año = hoy.getFullYear();
    const jovenes = (await crearMinisterio(pastor, ws, { name: "Jóvenes", year: año }).expect(201)).body;

    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await gasto(pastor, ws, { amount: 100, ministry: jovenes._id, date: ayer }).expect(201);
    await gasto(pastor, ws, { amount: 900, ministry: jovenes._id, date: manana }).expect(201);
    const anulado = (await gasto(pastor, ws, { amount: 500, ministry: jovenes._id, date: ayer }).expect(201)).body[0];
    await as("post", `/api/v1/transactions/${anulado._id}/void`, pastor, ws)
      .send({ reason: "duplicado" })
      .expect(200);

    assert.equal((await listar(pastor, ws, año)).ministries[0].spent, 100);
  });

  test("el líder SOLO ve su ministerio, no el libro de la iglesia", async () => {
    const { pastor, ws } = await iglesia();
    const lider = await createUser();
    await invitarYAceptar(pastor, ws, lider, "lider");

    const jovenes = (await crearMinisterio(pastor, ws, { name: "Jóvenes", leader: lider.user.id }).expect(201)).body;
    const damas = (await crearMinisterio(pastor, ws, { name: "Damas" }).expect(201)).body;

    await gasto(pastor, ws, { amount: 200, ministry: jovenes._id, description: "Campamento" }).expect(201);
    await gasto(pastor, ws, { amount: 900, ministry: damas._id, description: "Retiro de damas" }).expect(201);
    await gasto(pastor, ws, { amount: 2000, description: "Alquiler del local" }).expect(201);

    //! En su lista solo está el suyo
    const suya = await listar(lider, ws);
    assert.equal(suya.ministries.length, 1);
    assert.equal(suya.ministries[0].name, "Jóvenes");
    assert.equal(suya.ministries[0].spent, 200);

    //! Y el tesorero ve los dos
    assert.equal((await listar(pastor, ws)).ministries.length, 2);

    //! El líder NO puede ver los movimientos de la iglesia
    await as("get", "/api/v1/transactions/lists", lider, ws).expect(403);
    await as("get", "/api/v1/transactions/balance", lider, ws).expect(403);
    await as("get", "/api/v1/funds", lider, ws).expect(403);
    await as("get", "/api/v1/donors", lider, ws).expect(403);
    await as("get", "/api/v1/reports/anual", lider, ws).expect(403);

    //! Ni tocar nada
    await crearMinisterio(lider, ws, { name: "Suyo propio" }).expect(403);
    await as("put", `/api/v1/ministerios/${jovenes._id}`, lider, ws).send({ budget: 99999 }).expect(403);
    await as("delete", `/api/v1/ministerios/${damas._id}`, lider, ws).expect(403);
  });

  test("el líder ve los gastos del suyo y no los del ministerio de al lado", async () => {
    const { pastor, ws } = await iglesia();
    const lider = await createUser();
    await invitarYAceptar(pastor, ws, lider, "lider");

    const jovenes = (await crearMinisterio(pastor, ws, { name: "Jóvenes", leader: lider.user.id }).expect(201)).body;
    const damas = (await crearMinisterio(pastor, ws, { name: "Damas" }).expect(201)).body;
    await gasto(pastor, ws, { amount: 200, ministry: jovenes._id, description: "Campamento" }).expect(201);
    await gasto(pastor, ws, { amount: 900, ministry: damas._id, description: "Retiro de damas" }).expect(201);

    const mios = await as("get", `/api/v1/ministerios/${jovenes._id}/gastos`, lider, ws).expect(200);
    assert.equal(mios.body.length, 1);
    assert.equal(mios.body[0].description, "Campamento");
    assert.equal(mios.body[0].amount, 200);

    //! El de al lado, prohibido
    await as("get", `/api/v1/ministerios/${damas._id}/gastos`, lider, ws).expect(403);

    //! El tesorero sí puede ver los dos
    await as("get", `/api/v1/ministerios/${damas._id}/gastos`, pastor, ws).expect(200);
  });

  test("el líder de una iglesia no alcanza los ministerios de otra", async () => {
    const { pastor, ws } = await iglesia();
    const otra = await iglesia();
    const lider = await createUser();
    await invitarYAceptar(pastor, ws, lider, "lider");

    const ajeno = (await crearMinisterio(otra.pastor, otra.ws, { name: "Jóvenes" }).expect(201)).body;

    await as("get", `/api/v1/ministerios/${ajeno._id}/gastos`, lider, ws).expect(404);
    await as("get", `/api/v1/ministerios/${ajeno._id}/gastos`, pastor, ws).expect(404);
  });

  test("no se repiten nombres en el mismo año, pero sí de un año a otro", async () => {
    const { pastor, ws } = await iglesia();

    await crearMinisterio(pastor, ws, { name: "Jóvenes" }).expect(201);
    await crearMinisterio(pastor, ws, { name: "jóvenes" }).expect(409);
    //! El año que viene se vuelve a aprobar, con otro presupuesto
    await crearMinisterio(pastor, ws, { name: "Jóvenes", year: AÑO + 1, budget: 4000 }).expect(201);

    assert.equal((await listar(pastor, ws)).ministries.length, 1);
    assert.equal((await listar(pastor, ws, AÑO + 1)).ministries[0].budget, 4000);
  });

  test("los datos imposibles se rechazan", async () => {
    const { pastor, ws } = await iglesia();
    const fuera = await createUser();

    await crearMinisterio(pastor, ws, { name: "" }).expect(400);
    await crearMinisterio(pastor, ws, { name: "Jóvenes", budget: -5 }).expect(400);
    await crearMinisterio(pastor, ws, { name: "Jóvenes", year: 1800 }).expect(400);
    //! Nombrar líder a alguien que no es miembro sería darle acceso
    await crearMinisterio(pastor, ws, { name: "Jóvenes", leader: fuera.user.id }).expect(400);
    await crearMinisterio(pastor, ws, { name: "Jóvenes", leader: "no-es-un-id" }).expect(400);

    assert.equal(await Ministry.countDocuments(), 0);
  });

  test("un ministerio con gastos se archiva, no se borra", async () => {
    const { pastor, ws } = await iglesia();
    const jovenes = (await crearMinisterio(pastor, ws, { name: "Jóvenes" }).expect(201)).body;

    //! Sin usar, se borra
    const vacio = (await crearMinisterio(pastor, ws, { name: "Sin usar" }).expect(201)).body;
    await as("delete", `/api/v1/ministerios/${vacio._id}`, pastor, ws).expect(200);

    await gasto(pastor, ws, { amount: 100, ministry: jovenes._id }).expect(201);
    const res = await as("delete", `/api/v1/ministerios/${jovenes._id}`, pastor, ws).expect(409);
    assert.equal(res.body.code, "MINISTRY_IN_USE");

    await as("put", `/api/v1/ministerios/${jovenes._id}`, pastor, ws).send({ archived: true }).expect(200);
    //! Y a un ministerio archivado ya no se le carga nada nuevo
    await gasto(pastor, ws, { amount: 50, ministry: jovenes._id }).expect(409);
  });

  test("cambiar un gasto de ministerio mueve el presupuesto", async () => {
    const { pastor, ws } = await iglesia();
    const jovenes = (await crearMinisterio(pastor, ws, { name: "Jóvenes" }).expect(201)).body;
    const damas = (await crearMinisterio(pastor, ws, { name: "Damas" }).expect(201)).body;

    const tx = (await gasto(pastor, ws, { amount: 300, ministry: jovenes._id }).expect(201)).body[0];
    assert.equal((await listar(pastor, ws)).ministries.find((m) => m.name === "Jóvenes").spent, 300);

    await as("put", `/api/v1/transactions/update/${tx._id}`, pastor, ws)
      .send({ ministry: damas._id })
      .expect(200);

    const lista = (await listar(pastor, ws)).ministries;
    assert.equal(lista.find((m) => m.name === "Jóvenes").spent, 0);
    assert.equal(lista.find((m) => m.name === "Damas").spent, 300);

    //! Y quitarlo lo deja sin ministerio
    await as("put", `/api/v1/transactions/update/${tx._id}`, pastor, ws)
      .send({ ministry: null })
      .expect(200);
    assert.equal((await listar(pastor, ws)).ministries.find((m) => m.name === "Damas").spent, 0);
  });

  test("un lector no ve los presupuestos", async () => {
    const { pastor, ws } = await iglesia();
    const lector = await createUser();
    await invitarYAceptar(pastor, ws, lector, "lector");

    await as("get", "/api/v1/ministerios", lector, ws).expect(403);
  });
});
