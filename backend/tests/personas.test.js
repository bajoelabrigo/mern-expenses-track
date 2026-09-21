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

const crearPersona = (user, ws, body) => as("post", "/api/v1/donors", user, ws).send(body);
const personas = async (user, ws, query = "") =>
  (await as("get", `/api/v1/donors${query}`, user, ws).expect(200)).body;

const ingreso = (user, ws, body) =>
  as("post", "/api/v1/transactions/create", user, ws).send({
    type: "income",
    category: "diezmos",
    date: "2026-05-10",
    ...body,
  });

const gasto = (user, ws, body) =>
  as("post", "/api/v1/transactions/create", user, ws).send({
    type: "expense",
    category: "servicios",
    date: "2026-06-10",
    ...body,
  });

describe("Pagos a personas (remuneraciones)", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("un gasto dice a quién se le pagó y por qué, y se ve en el movimiento", async () => {
    const { pastor, ws } = await iglesia();
    const ana = (await crearPersona(pastor, ws, { name: "Ana Torres", document: "45789123", member: true }).expect(201)).body;
    assert.equal(ana.member, true);
    assert.equal(ana.paid, 0);

    const creado = await gasto(pastor, ws, {
      amount: 250,
      description: "Cocinó en la actividad de jóvenes",
      payee: ana._id,
      paymentKind: "jornal",
    }).expect(201);

    //! Al crear se devuelve la persona por su id (como el aportante); el nombre
    //! llega al listar
    assert.equal(String(creado.body[0].payee), String(ana._id));
    assert.equal(creado.body[0].paymentKind, "jornal");
    assert.equal(creado.body[0].amount, 250);

    //! Y en el listado y en uno concreto
    const lista = await as("get", "/api/v1/transactions/lists", pastor, ws).expect(200);
    assert.equal(lista.body.transactions[0].payee.name, "Ana Torres");
    const uno = await as("get", `/api/v1/transactions/${creado.body[0]._id}`, pastor, ws).expect(200);
    assert.equal(uno.body.paymentKind, "jornal");
  });

  test("solo los gastos llevan persona y concepto; el concepto solo va con un pago", async () => {
    const { pastor, ws } = await iglesia();
    const otra = await iglesia();
    const ajena = (await crearPersona(otra.pastor, otra.ws, { name: "Ajena" }).expect(201)).body;
    const ana = (await crearPersona(pastor, ws, { name: "Ana" }).expect(201)).body;

    //! Un ingreso no lleva a quién se le pagó
    await ingreso(pastor, ws, { amount: 10, payee: ana._id }).expect(400);
    //! Ni una persona de otro espacio
    await gasto(pastor, ws, { amount: 10, payee: ajena._id }).expect(404);
    await gasto(pastor, ws, { amount: 10, payee: "no-es-id" }).expect(400);
    //! Concepto inventado
    await gasto(pastor, ws, { amount: 10, payee: ana._id, paymentKind: "soborno" }).expect(400);

    //! Un concepto sin persona no se guarda (no significa nada)
    const sinPersona = await gasto(pastor, ws, { amount: 10, paymentKind: "jornal" }).expect(201);
    assert.equal(sinPersona.body[0].payee, null);
    assert.equal(sinPersona.body[0].paymentKind, null);

    //! Al pasar el gasto a ingreso se limpia todo
    const pago = (await gasto(pastor, ws, { amount: 30, payee: ana._id, paymentKind: "servicio" }).expect(201)).body[0];
    const editado = await as("put", `/api/v1/transactions/update/${pago._id}`, pastor, ws)
      .send({ type: "income", category: "ofrendas" })
      .expect(200);
    assert.equal(editado.body.payee, null);
    assert.equal(editado.body.paymentKind, null);
  });

  test("quién recibió cuánto tampoco lo ve el auditor", async () => {
    const { pastor, ws } = await iglesia();
    const contador = await createUser();
    const auditor = await createUser();
    await invitarYAceptar(pastor, ws, contador, "contador");
    await invitarYAceptar(pastor, ws, auditor, "auditor");

    const ana = (await crearPersona(pastor, ws, { name: "Ana" }).expect(201)).body;
    const tx = (await gasto(pastor, ws, { amount: 200, payee: ana._id, paymentKind: "jornal" }).expect(201)).body[0];

    const delContador = await as("get", "/api/v1/transactions/lists", contador, ws).expect(200);
    assert.equal(delContador.body.transactions[0].payee.name, "Ana");

    //! El auditor ve el gasto y su monto, pero no a quién se le pagó
    const delAuditor = await as("get", "/api/v1/transactions/lists", auditor, ws).expect(200);
    assert.equal(delAuditor.body.transactions[0].amount, 200);
    assert.equal(delAuditor.body.transactions[0].payee, undefined);
    const uno = await as("get", `/api/v1/transactions/${tx._id}`, auditor, ws).expect(200);
    assert.equal(uno.body.payee, undefined);

    //! Ni el informe de pagos ni las constancias
    await as("get", "/api/v1/donors/pagos?year=2026", auditor, ws).expect(403);
    await as("get", "/api/v1/donors/constancias-pagos?year=2026", auditor, ws).expect(403);
    //! Ni puede registrar un pago "a nombre de" alguien
    await gasto(auditor, ws, { amount: 10, payee: ana._id }).expect(403);
  });

  test("la misma ficha suma las dos direcciones: lo que dio y lo que se le pagó", async () => {
    const { pastor, ws } = await iglesia();
    const ana = (await crearPersona(pastor, ws, { name: "Ana Torres", member: true }).expect(201)).body;
    const luis = (await crearPersona(pastor, ws, { name: "Luis Paredes" }).expect(201)).body;

    await ingreso(pastor, ws, { amount: 300, donor: ana._id }).expect(201);
    await gasto(pastor, ws, { amount: 250, payee: ana._id, paymentKind: "jornal" }).expect(201);
    await gasto(pastor, ws, { amount: 100, payee: ana._id, paymentKind: "reembolso", date: "2026-07-02" }).expect(201);
    //! Un gasto anulado no cuenta
    const anulado = (await gasto(pastor, ws, { amount: 999, payee: ana._id }).expect(201)).body[0];
    await as("post", `/api/v1/transactions/${anulado._id}/void`, pastor, ws).send({ reason: "Duplicado" }).expect(200);
    //! De otro año no entra en el total del año
    await gasto(pastor, ws, { amount: 500, payee: ana._id, date: "2025-06-10" }).expect(201);
    //! Y a otra persona no se le mezcla
    await gasto(pastor, ws, { amount: 80, payee: luis._id }).expect(201);

    const lista = await personas(pastor, ws, "?year=2026");
    const porNombre = Object.fromEntries(
      lista.donors.map((d) => [d.name, { given: d.given, paid: d.paid, payments: d.payments }])
    );
    assert.deepEqual(porNombre["Ana Torres"], { given: 300, paid: 350, payments: 2 });
    assert.deepEqual(porNombre["Luis Paredes"], { given: 0, paid: 80, payments: 1 });

    const ficha = (await as("get", `/api/v1/donors/${ana._id}?year=2026`, pastor, ws).expect(200)).body;
    assert.equal(ficha.given, 300);
    assert.equal(ficha.paid, 350);
    assert.equal(ficha.payments, 2);
    assert.equal(ficha.paidAllTime, 850);
    assert.equal(ficha.paymentsAllTime, 3);
    assert.equal(ficha.member, true);

    //! Se filtra por persona en Movimientos: los tres pagos (el anulado no sale
    //! salvo que se pidan los anulados)
    const suyos = await as("get", `/api/v1/transactions/lists?payee=${ana._id}`, pastor, ws).expect(200);
    assert.equal(suyos.body.total, 3);
    const conAnulados = await as(
      "get",
      `/api/v1/transactions/lists?payee=${ana._id}&includeVoided=true`,
      pastor,
      ws
    ).expect(200);
    assert.equal(conAnulados.body.total, 4);
    //! "sin" mira el campo vacío (como el ?donor=sin de hoy): eso incluye los
    //! ingresos, que no llevan a quién se le pagó
    const sinPersona = await as("get", "/api/v1/transactions/lists?payee=sin", pastor, ws).expect(200);
    assert.equal(sinPersona.body.total, 1);
    assert.equal(sinPersona.body.transactions[0].type, "income");
  });

  test("el informe de pagos suma, separa por concepto y dice qué parte del gasto es", async () => {
    const { pastor, ws } = await iglesia();
    const ana = (await crearPersona(pastor, ws, { name: "Ana", member: true }).expect(201)).body;
    const luis = (await crearPersona(pastor, ws, { name: "Luis" }).expect(201)).body;

    await gasto(pastor, ws, { amount: 250, payee: ana._id, paymentKind: "jornal" }).expect(201);
    await gasto(pastor, ws, { amount: 150, payee: luis._id, paymentKind: "honorarios" }).expect(201);
    await gasto(pastor, ws, { amount: 100, payee: ana._id, paymentKind: "jornal" }).expect(201);
    //! Un gasto sin persona: cuenta en el gasto total, no en los pagos
    await gasto(pastor, ws, { amount: 500, category: "alquiler" }).expect(201);
    //! Un ingreso no cuenta como gasto
    await ingreso(pastor, ws, { amount: 1000 }).expect(201);

    const informe = (await as("get", "/api/v1/donors/pagos?year=2026", pastor, ws).expect(200)).body;
    assert.equal(informe.total, 500);
    assert.equal(informe.payments, 3);
    assert.equal(informe.expenseTotal, 1000);
    assert.equal(informe.share, 50);
    assert.deepEqual(
      informe.byKind,
      [
        { kind: "jornal", label: "Jornal", amount: 350 },
        { kind: "honorarios", label: "Honorarios", amount: 150 },
      ]
    );
    assert.deepEqual(
      informe.people.map((p) => [p.name, p.amount, p.member]),
      [
        ["Ana", 350, true],
        ["Luis", 150, false],
      ]
    );

    await as("get", "/api/v1/donors/pagos?year=abc", pastor, ws).expect(400);
  });

  test("la constancia de pagos sale en PDF y lleva el 'Recibí conforme'", async () => {
    const { pastor, ws } = await iglesia();
    const ana = (await crearPersona(pastor, ws, { name: "Ana Torres", document: "45789123" }).expect(201)).body;
    const luis = (await crearPersona(pastor, ws, { name: "Luis Paredes" }).expect(201)).body;
    await gasto(pastor, ws, { amount: 250, payee: ana._id, paymentKind: "jornal", date: "2026-02-10" }).expect(201);
    await gasto(pastor, ws, { amount: 100, payee: ana._id, paymentKind: "reembolso", date: "2026-03-10" }).expect(201);
    await gasto(pastor, ws, { amount: 80, payee: luis._id, paymentKind: "servicio", date: "2026-03-11" }).expect(201);

    const { paymentSummaries } = require("../controllers/donorController");
    const resumen = (await paymentSummaries(ws, 2026)).get(String(ana._id));
    assert.equal(resumen.total, 350);
    assert.deepEqual(resumen.byKind, [
      { kind: "jornal", amount: 250 },
      { kind: "reembolso", amount: 100 },
    ]);
    assert.deepEqual(resumen.byMonth, [
      { month: 2, amount: 250 },
      { month: 3, amount: 100 },
    ]);

    const pdf = (url) =>
      as("get", url, pastor, ws)
        .buffer()
        .parse((res, cb) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(Buffer.from(c)));
          res.on("end", () => cb(null, Buffer.concat(chunks)));
        });
    const paginas = (buffer) => buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length || 0;

    const una = await pdf(`/api/v1/donors/${ana._id}/constancia-pagos?year=2026`).expect(200);
    assert.match(una.headers["content-type"], /application\/pdf/);
    assert.match(una.headers["content-disposition"], /constancia-pagos-ana-torres-2026\.pdf/);
    assert.equal(paginas(una.body), 1);

    const todas = await pdf("/api/v1/donors/constancias-pagos?year=2026").expect(200);
    assert.equal(paginas(todas.body), 2);

    //! Sin pagos ese año no se emite nada
    const vacio = await as("get", `/api/v1/donors/${ana._id}/constancia-pagos?year=2024`, pastor, ws).expect(409);
    assert.equal(vacio.body.code, "NO_PAYMENTS");
    await as("get", "/api/v1/donors/constancias-pagos?year=2024", pastor, ws).expect(409);
  });

  test("a quien se le pagó no se borra: se archiva", async () => {
    const { pastor, ws } = await iglesia();
    const ana = (await crearPersona(pastor, ws, { name: "Ana" }).expect(201)).body;
    const nuevo = (await crearPersona(pastor, ws, { name: "Sin nada" }).expect(201)).body;

    await gasto(pastor, ws, { amount: 250, payee: ana._id }).expect(201);

    await as("delete", `/api/v1/donors/${nuevo._id}`, pastor, ws).expect(200);
    const enUso = await as("delete", `/api/v1/donors/${ana._id}`, pastor, ws).expect(409);
    assert.equal(enUso.body.code, "DONOR_IN_USE");

    const archivada = await as("put", `/api/v1/donors/${ana._id}`, pastor, ws)
      .send({ archived: true })
      .expect(200);
    assert.equal(archivada.body.archived, true);
    //! Sigue contando para el informe aunque esté archivada
    const informe = (await as("get", "/api/v1/donors/pagos?year=2026", pastor, ws).expect(200)).body;
    assert.equal(informe.total, 250);
  });
});
