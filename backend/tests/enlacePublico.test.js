const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  app,
  request,
  setupDatabase,
  teardownDatabase,
  clearDatabase,
  createUser,
  hoy,
} = require("./helpers");
const PublicReport = require("../model/PublicReport");

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

const movimiento = (user, ws, body) =>
  as("post", "/api/v1/transactions/create", user, ws).send({
    type: "income",
    category: "diezmos",
    date: hoy(),
    ...body,
  });

const tokenDe = (url) => url.split("/cuentas/")[1];

describe("Enlace de solo lectura para la congregación", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("el propietario crea el enlace y la congregación ve los totales sin cuenta", async () => {
    const { pastor, ws } = await iglesia();
    await movimiento(pastor, ws, { amount: 1000 }).expect(201);
    await movimiento(pastor, ws, { type: "expense", category: "luz", amount: 250 }).expect(201);

    //! Antes de crearlo no hay enlace
    assert.equal((await as("get", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws).expect(200)).body, null);

    const creado = await as("post", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws)
      .send({ period: "mes" })
      .expect(201);

    assert.match(creado.body.url, /\/cuentas\/[a-f0-9]{64}$/);
    assert.equal(creado.body.active, true);

    //! Sin ninguna sesión
    const publico = await request(app).get(`/api/v1/publico/${tokenDe(creado.body.url)}`).expect(200);
    assert.equal(publico.body.church, "Iglesia Betel");
    assert.equal(publico.body.income, 1000);
    assert.equal(publico.body.expense, 250);
    assert.equal(publico.body.result, 750);
    assert.equal(publico.body.currency, "USD");
  });

  test("el resumen público NO lleva aportantes ni detalle de movimientos", async () => {
    const { pastor, ws } = await iglesia();
    const marta = (await as("post", "/api/v1/donors", pastor, ws).send({ name: "Marta Quispe" }).expect(201)).body;
    await movimiento(pastor, ws, {
      amount: 500,
      donor: marta._id,
      description: "Diezmo de Marta en efectivo",
    }).expect(201);

    const creado = await as("post", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws).expect(201);
    const publico = await request(app).get(`/api/v1/publico/${tokenDe(creado.body.url)}`).expect(200);

    const texto = JSON.stringify(publico.body);
    //! Lo que no puede salir de aquí de ninguna manera
    assert.ok(!texto.includes("Marta"), "no puede aparecer quién dio");
    assert.ok(!texto.includes("Diezmo de Marta"), "no puede aparecer el concepto de un movimiento");
    assert.ok(!texto.includes(String(pastor.user.username)), "no puede aparecer quién registró");
    assert.equal(publico.body.transactions, undefined);
    assert.equal(publico.body.donors, undefined);
    assert.equal(publico.body.receipts, undefined);

    //! Sí sale el total y el reparto por tipo de aporte
    assert.equal(publico.body.income, 500);
    assert.deepEqual(publico.body.incomeBreakdown, [{ kind: "diezmo", amount: 500 }]);
  });

  test("rehacer el enlace tumba el anterior", async () => {
    const { pastor, ws } = await iglesia();
    const primero = await as("post", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws).expect(201);
    await request(app).get(`/api/v1/publico/${tokenDe(primero.body.url)}`).expect(200);

    const segundo = await as("post", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws).expect(201);
    assert.notEqual(segundo.body.url, primero.body.url);

    //! El viejo ya no sirve: es la forma de cortar el acceso
    await request(app).get(`/api/v1/publico/${tokenDe(primero.body.url)}`).expect(404);
    await request(app).get(`/api/v1/publico/${tokenDe(segundo.body.url)}`).expect(200);
  });

  test("apagarlo y borrarlo dejan de servir el resumen", async () => {
    const { pastor, ws } = await iglesia();
    const creado = await as("post", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws).expect(201);
    const token = tokenDe(creado.body.url);

    await as("put", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws)
      .send({ active: false })
      .expect(200);
    await request(app).get(`/api/v1/publico/${token}`).expect(404);

    //! Se puede volver a encender con el mismo enlace
    await as("put", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws)
      .send({ active: true })
      .expect(200);
    await request(app).get(`/api/v1/publico/${token}`).expect(200);

    await as("delete", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws).expect(200);
    await request(app).get(`/api/v1/publico/${token}`).expect(404);
    assert.equal(await PublicReport.countDocuments(), 0);
  });

  test("el token se guarda con hash, no en claro", async () => {
    const { pastor, ws } = await iglesia();
    const creado = await as("post", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws).expect(201);
    const token = tokenDe(creado.body.url);

    const guardado = await PublicReport.findOne({ workspace: ws });
    assert.notEqual(guardado.tokenHash, token, "el token no puede estar en claro");
    assert.equal(guardado.tokenHash.length, 64);
    //! Ni siquiera al propietario se le devuelve después: si lo pierde, lo rehace
    const consulta = await as("get", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws).expect(200);
    assert.equal(consulta.body.url, undefined);
    assert.equal(consulta.body.hint, token.slice(-6));
  });

  test("un enlace inventado o mal formado no revela si existe", async () => {
    await request(app).get("/api/v1/publico/no-es-un-token").expect(404);
    await request(app).get(`/api/v1/publico/${"a".repeat(64)}`).expect(404);
    await request(app).get("/api/v1/publico/").expect(404);
  });

  test("solo el propietario maneja el enlace", async () => {
    const { pastor, ws } = await iglesia();
    const tesorero = await createUser();
    await invitarYAceptar(pastor, ws, tesorero, "tesorero");

    await as("get", `/api/v1/workspaces/${ws}/enlace-publico`, tesorero, ws).expect(403);
    await as("post", `/api/v1/workspaces/${ws}/enlace-publico`, tesorero, ws).expect(403);
    await as("delete", `/api/v1/workspaces/${ws}/enlace-publico`, tesorero, ws).expect(403);
    assert.equal(await PublicReport.countDocuments(), 0);
  });

  test("se puede publicar el año en vez del mes, y ocultar los fondos", async () => {
    const { pastor, ws } = await iglesia();
    await as("post", "/api/v1/funds", pastor, ws).send({ name: "Misiones" }).expect(201);
    await movimiento(pastor, ws, { amount: 700 }).expect(201);

    const creado = await as("post", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws)
      .send({ period: "anio", showFunds: false })
      .expect(201);
    const token = tokenDe(creado.body.url);

    const anual = await request(app).get(`/api/v1/publico/${token}`).expect(200);
    assert.equal(anual.body.period, "anio");
    assert.equal(anual.body.months.length, 12);
    assert.equal(anual.body.funds, null, "los fondos quedan ocultos si así se pidió");

    await as("put", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws)
      .send({ period: "mes", showFunds: true })
      .expect(200);
    const mensual = await request(app).get(`/api/v1/publico/${token}`).expect(200);
    assert.equal(mensual.body.period, "mes");
    assert.equal(mensual.body.months, null);
    assert.ok(Array.isArray(mensual.body.funds));

    await as("put", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws)
      .send({ period: "trimestre" })
      .expect(400);
  });

  test("cuenta las visitas para que el propietario sepa si lo están usando", async () => {
    const { pastor, ws } = await iglesia();
    const creado = await as("post", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws).expect(201);
    assert.equal(creado.body.views, 0);
    const token = tokenDe(creado.body.url);

    await request(app).get(`/api/v1/publico/${token}`).expect(200);
    await request(app).get(`/api/v1/publico/${token}`).expect(200);

    //! El contador se actualiza sin bloquear la respuesta: se espera un poco
    await new Promise((r) => setTimeout(r, 120));
    const estado = await as("get", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws).expect(200);
    assert.equal(estado.body.views, 2);
    assert.ok(estado.body.lastViewedAt);
  });

  test("borrar el espacio se lleva su enlace", async () => {
    const { pastor, ws } = await iglesia();
    const creado = await as("post", `/api/v1/workspaces/${ws}/enlace-publico`, pastor, ws).expect(201);

    const workspaces = (await as("get", "/api/v1/workspaces", pastor).expect(200)).body;
    const nombre = workspaces.find((w) => String(w._id) === String(ws)).name;
    await as("delete", `/api/v1/workspaces/${ws}`, pastor).send({ confirmName: nombre }).expect(200);

    await request(app).get(`/api/v1/publico/${tokenDe(creado.body.url)}`).expect(404);
    //! Y no queda la fila dando vueltas
    assert.equal(await PublicReport.countDocuments({ workspace: ws }), 0);
  });
});
