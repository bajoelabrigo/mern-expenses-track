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

const crearPersona = (user, ws, body) =>
  as("post", "/api/v1/donors", user, ws).send(body).expect(201);

describe("Privacidad del dinero en los listados y el historial", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("un rol sin donor:read no puede filtrar por persona (aunque oculte el campo)", async () => {
    const { pastor, ws } = await iglesia();
    const lector = await createUser();
    const auditor = await createUser();
    await invitarYAceptar(pastor, ws, lector, "lector");
    await invitarYAceptar(pastor, ws, auditor, "auditor");

    const ana = (await crearPersona(pastor, ws, { name: "Ana Torres" })).body;
    await as("post", "/api/v1/transactions/create", pastor, ws)
      .send({ type: "income", category: "diezmos", amount: 300, date: "2026-05-10", donor: ana._id })
      .expect(201);
    await as("post", "/api/v1/transactions/create", pastor, ws)
      .send({ type: "expense", category: "servicios", amount: 120, date: "2026-06-10", payee: ana._id, paymentKind: "jornal" })
      .expect(201);

    //! Quien sí puede ver personas: el filtro funciona
    const delPastor = await as("get", `/api/v1/transactions/lists?donor=${ana._id}`, pastor, ws).expect(200);
    assert.equal(delPastor.body.total, 1);

    //! Quien no: se rechaza, en el listado, en el balance y en el Excel
    for (const quien of [lector, auditor]) {
      const r = await as("get", `/api/v1/transactions/lists?donor=${ana._id}`, quien, ws).expect(403);
      assert.match(r.body.message, /no permite filtrar/i);
      await as("get", `/api/v1/transactions/lists?payee=${ana._id}`, quien, ws).expect(403);
      await as("get", `/api/v1/transactions/balance?donor=${ana._id}`, quien, ws).expect(403);
      await as("get", `/api/v1/transactions/export/excel?payee=${ana._id}`, quien, ws).expect(403);
    }

    //! Y sin filtro siguen viendo el libro (no se les rompe nada)
    await as("get", "/api/v1/transactions/lists", lector, ws).expect(200);
    await as("get", "/api/v1/transactions/balance", auditor, ws).expect(200);
  });

  test("el correo de una persona no aparece en el historial que lee el auditor", async () => {
    const { pastor, ws } = await iglesia();
    const tesorera = await createUser();
    const nueva = await createUser();
    const invitada = await createUser();
    const auditor = await createUser();
    await invitarYAceptar(pastor, ws, tesorera, "tesorero");
    await invitarYAceptar(pastor, ws, auditor, "auditor");

    //! Alta directa e invitación: las dos dejan el correo en el historial
    await as("post", `/api/v1/workspaces/${ws}/members`, pastor)
      .send({ email: nueva.credentials.email, role: "contador" })
      .expect(201);
    await as("post", `/api/v1/workspaces/${ws}/invitations`, pastor)
      .send({ email: invitada.credentials.email, role: "lector" })
      .expect(201);

    const vistaPastor = await as("get", `/api/v1/workspaces/${ws}/audit`, pastor).expect(200);
    const conCorreoPastor = vistaPastor.body.entries.filter((e) => e.after?.email || e.before?.email);
    assert.ok(conCorreoPastor.length > 0, "la tesorería sí ve los correos en el historial");

    const vistaAuditor = await as("get", `/api/v1/workspaces/${ws}/audit`, auditor).expect(200);
    assert.ok(vistaAuditor.body.entries.length > 0, "el auditor lee el historial");
    vistaAuditor.body.entries.forEach((e) => {
      assert.equal(e.after?.email, undefined, "no debe ver el correo en 'después'");
      assert.equal(e.before?.email, undefined, "no debe ver el correo en 'antes'");
    });
    //! Pero sí el resto de la entrada (quién, qué rol, cuándo)
    const alta = vistaAuditor.body.entries.find((e) => e.action === "member.add");
    assert.equal(alta.after.role, "contador");
    assert.equal(alta.actorName, pastor.user.username);
  });

  test("el correo del líder de un ministerio no se entrega a quien solo mira ministerios", async () => {
    const { pastor, ws } = await iglesia();
    const lider = await createUser();
    const contador = await createUser();
    await invitarYAceptar(pastor, ws, lider, "lider");
    await invitarYAceptar(pastor, ws, contador, "contador");

    await as("post", "/api/v1/ministerios", pastor, ws)
      .send({ name: "Jóvenes", year: 2026, budget: 1000, leader: lider.user.id, icon: "🔥" })
      .expect(201);

    const vista = await as("get", "/api/v1/ministerios?year=2026", contador, ws).expect(200);
    const ministerio = vista.body.ministries.find((m) => m.name === "Jóvenes");
    assert.equal(ministerio.leader.username, lider.user.username);
    assert.equal(ministerio.leader._id || ministerio.leader.id ? true : false, true, "el id sigue llegando (lo usa el selector)");
    assert.equal(ministerio.leader.email, undefined, "el correo no");
  });
});

describe("Los totales del informe de un fondo suman en centavos", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("con importes de dos decimales el total es exacto, no aproximado", async () => {
    const { pastor, ws } = await iglesia();

    //! 0,1 + 0,2 en coma flotante da 0.30000000000000004: el informe debe dar 0.3
    const centavos = [
      ["income", 0.1, "diezmos"],
      ["income", 0.2, "diezmos"],
      ["expense", 19.99, "servicios"],
    ];
    for (const [type, amount, category] of centavos) {
      await as("post", "/api/v1/transactions/create", pastor, ws)
        .send({ type, category, amount, date: "2026-05-10" })
        .expect(201);
    }
    //! Y una decena de importes con centavos, que es donde se acumula el error
    for (let i = 0; i < 10; i += 1) {
      await as("post", "/api/v1/transactions/create", pastor, ws)
        .send({ type: "income", category: "ofrendas", amount: 10.07, date: "2026-05-11" })
        .expect(201);
    }

    //! El informe de un fondo se emite en PDF, pero sus números los arma
    //! `buildReportData`, que se exporta justo para poder comprobarlos
    const { buildReportData } = require("../controllers/fundController");
    const { report } = await buildReportData(ws, null, { withNames: false });
    const { raised, spent, balance } = report;

    assert.equal(raised, 101.0, "0.1 + 0.2 + (10 x 10.07)");
    assert.equal(spent, 19.99);
    assert.equal(balance, 81.01);
    //! Sin el error de coma flotante: el valor tiene dos decimales exactos
    assert.equal(Number(raised.toFixed(2)), raised);
    assert.equal(Number(balance.toFixed(2)), balance);
  });
});
