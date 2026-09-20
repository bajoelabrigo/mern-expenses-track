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

const movimiento = (user, ws, body) =>
  as("post", "/api/v1/transactions/create", user, ws).send({
    type: "income",
    category: "diezmos",
    ...body,
  });

const pdf = (url, user, ws) =>
  as("get", url, user, ws)
    .buffer()
    .parse((res, cb) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(Buffer.from(c)));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });

describe("Informes", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("el informe mensual abre con el saldo del mes anterior y cierra con el nuevo", async () => {
    const { pastor, ws } = await iglesia();
    const { monthlyReport } = require("../services/reportService");

    //! Lo de meses anteriores forma el saldo con el que se abre marzo
    await movimiento(pastor, ws, { amount: 1000, date: "2026-01-15" }).expect(201);
    await movimiento(pastor, ws, { type: "expense", category: "luz", amount: 200, date: "2026-02-10" }).expect(201);

    await movimiento(pastor, ws, { amount: 500, date: "2026-03-08" }).expect(201);
    await movimiento(pastor, ws, { category: "ofrendas", amount: 150, date: "2026-03-15" }).expect(201);
    await movimiento(pastor, ws, { type: "expense", category: "alquiler", amount: 300, date: "2026-03-20" }).expect(201);

    //! De abril: no entra en el informe de marzo
    await movimiento(pastor, ws, { amount: 999, date: "2026-04-02" }).expect(201);

    const informe = await monthlyReport(ws, 2026, 3, true);

    assert.equal(informe.opening, 800, "1000 de enero menos 200 de febrero");
    assert.equal(informe.income, 650);
    assert.equal(informe.expense, 300);
    assert.equal(informe.result, 350);
    assert.equal(informe.closing, 1150, "el saldo de apertura más el resultado");

    //! Los ingresos de una iglesia se agrupan por tipo de aporte
    assert.deepEqual(informe.incomeBreakdown, [
      { kind: "diezmo", amount: 500 },
      { kind: "ofrenda", amount: 150 },
    ]);
    assert.deepEqual(informe.expenseBreakdown, [{ category: "alquiler", amount: 300 }]);
  });

  test("el informe anual trae los doce meses, también los vacíos", async () => {
    const { pastor, ws } = await iglesia();
    const { annualReport } = require("../services/reportService");

    //! Un año ya cerrado: en el año en curso los meses que no han llegado van
    //! a cero, que es justo lo que se quiere (ver la regla de "hasta hoy")
    await movimiento(pastor, ws, { amount: 400, date: "2025-02-10" }).expect(201);
    await movimiento(pastor, ws, { type: "expense", category: "luz", amount: 100, date: "2025-02-20" }).expect(201);
    await movimiento(pastor, ws, { amount: 250, date: "2025-11-05" }).expect(201);

    const informe = await annualReport(ws, 2025, true);

    assert.equal(informe.months.length, 12);
    assert.deepEqual(informe.months[1], { month: 2, income: 400, expense: 100, result: 300 });
    assert.deepEqual(informe.months[0], { month: 1, income: 0, expense: 0, result: 0 });
    assert.equal(informe.months[10].income, 250);
    assert.equal(informe.income, 650);
    assert.equal(informe.expense, 100);
    assert.equal(informe.closing, 550);
  });

  test("los informes no cuentan lo anulado ni lo que todavía no pasó", async () => {
    const { pastor, ws } = await iglesia();
    const { monthlyReport } = require("../services/reportService");
    const hoy = new Date();
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const iso = (d) => d.toISOString().slice(0, 10);

    await movimiento(pastor, ws, { amount: 100, date: iso(ayer) }).expect(201);
    await movimiento(pastor, ws, { amount: 999, date: iso(manana) }).expect(201);
    const anulado = (await movimiento(pastor, ws, { amount: 500, date: iso(ayer) }).expect(201)).body[0];
    await as("post", `/api/v1/transactions/${anulado._id}/void`, pastor, ws)
      .send({ reason: "duplicado" })
      .expect(200);

    const informe = await monthlyReport(ws, hoy.getFullYear(), hoy.getMonth() + 1, true);
    //! Si ayer cayó en el mes anterior, lo de ayer forma el saldo de apertura
    assert.equal(informe.income + informe.opening, 100);
  });

  test("en un espacio personal los ingresos se agrupan por categoría, no por tipo", async () => {
    const persona = await createUser();
    const ws = persona.user.defaultWorkspace;

    await movimiento(persona, ws, { category: "sueldo", amount: 3000, date: "2026-05-05" }).expect(201);
    await movimiento(persona, ws, { category: "venta", amount: 200, date: "2026-05-06" }).expect(201);

    const { monthlyReport } = require("../services/reportService");
    const informe = await monthlyReport(ws, 2026, 5, false);

    assert.deepEqual(informe.incomeBreakdown, [
      { category: "sueldo", amount: 3000 },
      { category: "venta", amount: 200 },
    ]);
  });

  test("los dos informes se descargan en PDF y el auditor también puede", async () => {
    const { pastor, ws } = await iglesia();
    const auditor = await createUser();
    await invitarYAceptar(pastor, ws, auditor, "auditor");
    await movimiento(pastor, ws, { amount: 300, date: "2026-06-10" }).expect(201);

    const mensual = await pdf("/api/v1/reports/mensual?year=2026&month=6", pastor, ws).expect(200);
    assert.match(mensual.headers["content-type"], /application\/pdf/);
    assert.match(mensual.headers["content-disposition"], /informe-iglesia-betel-junio-2026\.pdf/);
    assert.ok(mensual.body.toString("latin1").startsWith("%PDF"));

    const anual = await pdf("/api/v1/reports/anual?year=2026", pastor, ws).expect(200);
    assert.match(anual.headers["content-disposition"], /informe-iglesia-betel-2026\.pdf/);
    assert.ok(anual.body.toString("latin1").startsWith("%PDF"));

    //! El auditor puede ver las cuentas, así que puede sacar el informe
    await pdf("/api/v1/reports/anual?year=2026", auditor, ws).expect(200);

    //! Fechas imposibles
    await as("get", "/api/v1/reports/mensual?year=2026&month=13", pastor, ws).expect(400);
    await as("get", "/api/v1/reports/anual?year=1800", pastor, ws).expect(400);
  });

  test("el reparto por fondos es el del cierre, no el de hoy", async () => {
    const { pastor, ws } = await iglesia();
    const { monthlyReport } = require("../services/reportService");
    const campana = (await as("post", "/api/v1/funds", pastor, ws).send({ name: "Campaña" }).expect(201)).body;

    await movimiento(pastor, ws, { amount: 500, fund: campana._id, date: "2026-03-10" }).expect(201);
    //! Esto es POSTERIOR al informe de marzo: no puede cambiarlo
    await movimiento(pastor, ws, { amount: 800, fund: campana._id, date: "2026-05-10" }).expect(201);

    const marzo = await monthlyReport(ws, 2026, 3, true);
    const campanaEnMarzo = marzo.funds.find((f) => f.name === "Campaña");
    assert.equal(campanaEnMarzo.amount, 500, "en marzo la campaña solo tenía 500");

    //! Y el reparto suma exactamente el saldo con el que cierra el mes
    const sumaFondos = marzo.funds.reduce((total, f) => total + f.amount, 0);
    assert.equal(sumaFondos, marzo.closing);

    const mayo = await monthlyReport(ws, 2026, 5, true);
    assert.equal(mayo.funds.find((f) => f.name === "Campaña").amount, 1300);
  });

  test("el informe reparte el saldo por fondos y omite los archivados vacíos", async () => {
    const { pastor, ws } = await iglesia();
    const misiones = (await as("post", "/api/v1/funds", pastor, ws).send({ name: "Misiones" }).expect(201)).body;
    const viejo = (await as("post", "/api/v1/funds", pastor, ws).send({ name: "Viejo" }).expect(201)).body;
    await as("put", `/api/v1/funds/${viejo._id}`, pastor, ws).send({ archived: true }).expect(200);

    await movimiento(pastor, ws, { amount: 700, date: "2026-07-01" }).expect(201);
    await movimiento(pastor, ws, { amount: 250, fund: misiones._id, date: "2026-07-02" }).expect(201);

    const { monthlyReport } = require("../services/reportService");
    const informe = await monthlyReport(ws, 2026, 7, true);

    assert.deepEqual(informe.funds, [
      { name: "General", amount: 700 },
      { name: "Misiones", amount: 250 },
    ]);
  });
});
