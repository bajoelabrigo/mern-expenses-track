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

//! Crea una transacción para el usuario del token
const crear = (token, payload) =>
  request(app)
    .post("/api/v1/transactions/create")
    .set("Authorization", `Bearer ${token}`)
    .send(payload);

describe("Transacciones", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("crea una transacción simple y normaliza la categoría", async () => {
    const { token } = await createUser();

    const res = await crear(token, {
      type: "income",
      category: "  Diezmos ",
      amount: 150.5,
      date: "2025-06-10T12:00:00.000Z",
      description: "Ofrenda dominical",
    }).expect(201);

    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].category, "diezmos");
    assert.equal(res.body[0].amount, 150.5);
  });

  test("rechaza montos no positivos y tipos inválidos", async () => {
    const { token } = await createUser();

    await crear(token, {
      type: "income",
      amount: -5,
      date: "2025-06-10",
    }).expect(400);

    await crear(token, {
      type: "otro",
      amount: 10,
      date: "2025-06-10",
    }).expect(400);
  });

  test("crea transacciones recurrentes mensuales con fechas correctas", async () => {
    const { token } = await createUser();

    const res = await crear(token, {
      type: "expense",
      category: "alquiler",
      amount: 500,
      date: "2025-01-31T12:00:00.000Z",
      recurrent: true,
      recurrenceType: "monthly",
      recurrenceCount: 3,
    }).expect(201);

    assert.equal(res.body.length, 3);
    const meses = res.body.map((t) => new Date(t.date).getMonth());
    assert.deepEqual(meses.slice(0, 1), [0]); // enero
    assert.equal(new Date(res.body[2].date).getFullYear(), 2025);
  });

  test("limita la cantidad de repeticiones y valida el tipo de recurrencia", async () => {
    const { token } = await createUser();

    await crear(token, {
      type: "expense",
      amount: 10,
      date: "2025-01-01",
      recurrent: true,
      recurrenceType: "monthly",
      recurrenceCount: 5000,
    }).expect(400);

    await crear(token, {
      type: "expense",
      amount: 10,
      date: "2025-01-01",
      recurrent: true,
      recurrenceType: "cada-rato",
      recurrenceCount: 2,
    }).expect(400);
  });

  test("el filtro por fecha final incluye las transacciones de ese mismo día", async () => {
    const { token } = await createUser();

    await crear(token, {
      type: "income",
      category: "diezmos",
      amount: 100,
      date: "2025-06-10T17:30:00.000Z",
    }).expect(201);

    const res = await request(app)
      .get("/api/v1/transactions/lists")
      .query({ startDate: "2025-06-01", endDate: "2025-06-10" })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(res.body.total, 1, "la transacción del último día debe aparecer");
  });

  test("la paginación devuelve totales y páginas coherentes", async () => {
    const { token } = await createUser();

    for (let i = 0; i < 7; i += 1) {
      await crear(token, {
        type: "expense",
        category: "servicios",
        amount: 10 + i,
        date: `2025-03-0${i + 1}T12:00:00.000Z`,
      }).expect(201);
    }

    const res = await request(app)
      .get("/api/v1/transactions/lists")
      .query({ page: 2, limit: 5 })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(res.body.total, 7);
    assert.equal(res.body.totalPages, 2);
    assert.equal(res.body.transactions.length, 2);
  });

  test("un usuario nunca ve ni modifica transacciones de otro", async () => {
    const dueño = await createUser();
    const intruso = await createUser();

    const creada = await crear(dueño.token, {
      type: "income",
      category: "diezmos",
      amount: 100,
      date: "2025-06-10T12:00:00.000Z",
    }).expect(201);

    const id = creada.body[0]._id;

    //! Desde su propio espacio el intruso ni siquiera sabe que existe (404)
    await request(app)
      .get(`/api/v1/transactions/${id}`)
      .set("Authorization", `Bearer ${intruso.token}`)
      .expect(404);

    await request(app)
      .put(`/api/v1/transactions/update/${id}`)
      .set("Authorization", `Bearer ${intruso.token}`)
      .send({ amount: 99999 })
      .expect(404);

    await request(app)
      .delete(`/api/v1/transactions/delete/${id}`)
      .set("Authorization", `Bearer ${intruso.token}`)
      .expect(404);

    //! Y pedir el espacio del dueño por la cabecera no le da acceso
    await request(app)
      .get("/api/v1/transactions/lists")
      .set("Authorization", `Bearer ${intruso.token}`)
      .set("X-Workspace-Id", String(dueño.user.defaultWorkspace))
      .expect(403);

    const listado = await request(app)
      .get("/api/v1/transactions/lists")
      .set("Authorization", `Bearer ${intruso.token}`)
      .expect(200);

    assert.equal(listado.body.total, 0);

    //! El movimiento del dueño sigue intacto
    const intacta = await request(app)
      .get(`/api/v1/transactions/${id}`)
      .set("Authorization", `Bearer ${dueño.token}`)
      .expect(200);
    assert.equal(intacta.body.amount, 100);
    assert.equal(intacta.body.voided, false);
  });

  test("una fecha sin hora se guarda al mediodía UTC (no se corre al día anterior)", async () => {
    const { token } = await createUser();

    const res = await crear(token, {
      type: "expense",
      amount: 10,
      date: "2026-09-15",
    }).expect(201);
    assert.equal(res.body[0].date, "2026-09-15T12:00:00.000Z");

    //! Un día imposible se rechaza en vez de saltar al mes siguiente
    await crear(token, { type: "expense", amount: 10, date: "2026-02-31" }).expect(400);
  });

  test("busca en descripción y categoría, de forma literal", async () => {
    const { token } = await createUser();
    await crear(token, { type: "income", category: "diezmos", amount: 10, date: "2026-09-01", description: "Culto del domingo" });
    await crear(token, { type: "expense", category: "luz", amount: 5, date: "2026-09-02", description: "Recibo (septiembre) 50% pagado" });
    await crear(token, { type: "expense", category: "agua", amount: 3, date: "2026-09-03", description: "Sedapal" });

    const buscar = (q) =>
      request(app)
        .get("/api/v1/transactions/lists")
        .query({ q })
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

    assert.equal((await buscar("DOMINGO")).body.total, 1);
    assert.equal((await buscar("luz")).body.total, 1);
    //! Caracteres especiales de expresión regular se buscan tal cual
    assert.equal((await buscar("(septiembre) 50%")).body.total, 1);
    assert.equal((await buscar(".*")).body.total, 0);
  });

  test("filtra los recurrentes", async () => {
    const { token } = await createUser();
    await crear(token, { type: "expense", category: "internet", amount: 99, date: "2026-09-01", recurrent: true, recurrenceType: "monthly", recurrenceCount: 2 });
    await crear(token, { type: "expense", category: "luz", amount: 5, date: "2026-09-02" });

    const res = await request(app)
      .get("/api/v1/transactions/lists")
      .query({ recurrent: "true" })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    assert.equal(res.body.total, 2);
    res.body.transactions.forEach((t) => assert.equal(t.recurrent, true));
  });

  test("un JSON mal formado responde 400 y no 500", async () => {
    const res = await request(app)
      .post("/api/v1/users/login")
      .set("Content-Type", "application/json")
      .send("{malo")
      .expect(400);
    assert.match(res.body.message, /JSON válido/);
  });

  test("un id con formato inválido responde 400 y no 500", async () => {
    const { token } = await createUser();

    const res = await request(app)
      .get("/api/v1/transactions/no-es-un-id")
      .set("Authorization", `Bearer ${token}`)
      .expect(400);

    assert.match(res.body.message, /inválido/i);
  });

  test("el balance suma ingresos y gastos del usuario autenticado", async () => {
    const { token } = await createUser();
    const otro = await createUser();

    await crear(token, {
      type: "income",
      category: "diezmos",
      amount: 300,
      date: "2025-06-10T12:00:00.000Z",
    }).expect(201);
    await crear(token, {
      type: "expense",
      category: "servicios",
      amount: 120,
      date: "2025-06-11T12:00:00.000Z",
    }).expect(201);
    //! Transacción de otro usuario: no debe contarse
    await crear(otro.token, {
      type: "income",
      category: "diezmos",
      amount: 999,
      date: "2025-06-11T12:00:00.000Z",
    }).expect(201);

    const res = await request(app)
      .get("/api/v1/transactions/balance")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(res.body.income, 300);
    assert.equal(res.body.expense, 120);
    assert.equal(res.body.balance, 180);
  });

  test("el resumen mensual devuelve los totales del mes en curso", async () => {
    const { token } = await createUser();
    const hoy = new Date();

    await crear(token, {
      type: "income",
      category: "diezmos",
      amount: 200,
      date: hoy.toISOString(),
    }).expect(201);

    const res = await request(app)
      .get("/api/v1/transactions/summary/monthly")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(res.body.income, 200);
    assert.equal(res.body.expense, 0);
  });

  test("el resumen por meses agrupa en la zona horaria pedida y omite los anulados", async () => {
    const { token } = await createUser();
    const porMes = (query) =>
      request(app)
        .get(`/api/v1/transactions/summary/by-month?${query}`)
        .set("Authorization", `Bearer ${token}`);

    //! 1 de febrero 03:00 UTC = 31 de enero 22:00 en Lima
    await crear(token, { type: "income", category: "diezmos", amount: 100, date: "2026-02-01T03:00:00.000Z" }).expect(201);
    await crear(token, { type: "expense", category: "luz", amount: 40.5, date: "2026-03-10T17:00:00.000Z" }).expect(201);
    const anulado = await crear(token, { type: "expense", category: "luz", amount: 999, date: "2026-03-11T17:00:00.000Z" }).expect(201);
    await request(app)
      .post(`/api/v1/transactions/${anulado.body[0]._id}/void`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "duplicado" })
      .expect(200);
    //! De otro año: no aparece
    await crear(token, { type: "income", category: "diezmos", amount: 7, date: "2025-12-15T17:00:00.000Z" }).expect(201);

    const lima = await porMes("year=2026&tz=America/Lima").expect(200);
    assert.equal(lima.body.months.length, 12);
    assert.deepEqual(lima.body.months[0], { month: 1, income: 100, expense: 0 });
    assert.deepEqual(lima.body.months[1], { month: 2, income: 0, expense: 0 });
    assert.deepEqual(lima.body.months[2], { month: 3, income: 0, expense: 40.5 });

    const utc = await porMes("year=2026").expect(200);
    assert.equal(utc.body.months[1].income, 100);

    await porMes("year=abc").expect(400);
    await porMes("year=2026&tz=Marte/Olympus").expect(400);
  });

  test("el endpoint de período filtra por tipo y por categoría", async () => {
    const { token } = await createUser();
    const hoy = new Date().toISOString();

    await crear(token, {
      type: "income",
      category: "diezmos",
      amount: 100,
      date: hoy,
    }).expect(201);
    await crear(token, {
      type: "income",
      category: "ofrendas",
      amount: 50,
      date: hoy,
    }).expect(201);
    await crear(token, {
      type: "expense",
      category: "servicios",
      amount: 30,
      date: hoy,
    }).expect(201);

    const soloDiezmos = await request(app)
      .get("/api/v1/transactions/period")
      .query({ period: "monthly", category: "diezmos" })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(soloDiezmos.body.length, 1);
    assert.equal(soloDiezmos.body[0].category, "diezmos");

    const soloGastos = await request(app)
      .get("/api/v1/transactions/period")
      .query({ period: "monthly", type: "expense" })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(soloGastos.body.length, 1);
    assert.equal(soloGastos.body[0].type, "expense");
  });

  test("el período rechaza valores desconocidos", async () => {
    const { token } = await createUser();

    await request(app)
      .get("/api/v1/transactions/period")
      .query({ period: "decenal" })
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
  });

  test("el export a Excel respeta los filtros y devuelve un xlsx", async () => {
    const { token } = await createUser();

    await crear(token, {
      type: "income",
      category: "diezmos",
      amount: 100,
      date: "2025-06-10T12:00:00.000Z",
    }).expect(201);
    await crear(token, {
      type: "income",
      category: "ofrendas",
      amount: 70,
      date: "2024-01-10T12:00:00.000Z",
    }).expect(201);

    //! supertest no bufferiza binarios por defecto: hay que acumular los chunks
    const res = await request(app)
      .get("/api/v1/transactions/export/excel")
      .query({ startDate: "2025-01-01", endDate: "2025-12-31" })
      .set("Authorization", `Bearer ${token}`)
      .buffer()
      .parse((response, callback) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    assert.match(
      res.headers["content-type"],
      /spreadsheetml\.sheet/,
      "debe devolver un xlsx"
    );
    assert.ok(res.body.length > 0, "el archivo no puede estar vacío");

    //! Se relee el libro para comprobar que solo entró la transacción filtrada
    const ExcelJS = require("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const sheet = wb.getWorksheet("Transacciones");
    const categorias = [];
    sheet.eachRow((row, i) => {
      if (i > 1) categorias.push(row.getCell(3).value);
    });
    assert.ok(categorias.includes("diezmos"));
    assert.ok(!categorias.includes("ofrendas"));

    //! En una iglesia, cada ingreso dice su tipo (aquí deducido del nombre)
    const encabezados = sheet.getRow(1).values.filter(Boolean);
    assert.ok(encabezados.includes("Tipo de ingreso"));
    assert.equal(sheet.getRow(2).getCell(encabezados.indexOf("Tipo de ingreso") + 1).value, "Diezmo");
  });

  test("el saldo no cuenta lo que todavía no pasó", async () => {
    const { token } = await createUser();
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await crear(token, { type: "income", category: "diezmos", amount: 500, date: ayer }).expect(201);
    //! Una repetición creada por adelantado (alquiler del mes que viene)
    await crear(token, { type: "expense", category: "alquiler", amount: 2000, date: manana }).expect(201);

    const balance = await request(app)
      .get("/api/v1/transactions/balance")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(balance.body.income, 500);
    assert.equal(balance.body.expense, 0, "el gasto de mañana todavía no salió");
    assert.equal(balance.body.balance, 500);

    //! El gráfico del año sigue la misma regla
    const mes = Number(manana.slice(5, 7));
    const porMes = await request(app)
      .get(`/api/v1/transactions/summary/by-month?year=${manana.slice(0, 4)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const fila = porMes.body.months?.find((m) => m.month === mes);
    assert.equal(fila?.expense || 0, 0, "el gasto de mañana tampoco pinta la barra");

    //! Pero el movimiento sigue existiendo en el listado
    const lista = await request(app)
      .get("/api/v1/transactions/lists")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    assert.equal(lista.body.total, 2);
  });

  test("actualizar una transacción valida los datos nuevos", async () => {
    const { token } = await createUser();

    const creada = await crear(token, {
      type: "income",
      category: "diezmos",
      amount: 100,
      date: "2025-06-10T12:00:00.000Z",
    }).expect(201);

    const id = creada.body[0]._id;

    await request(app)
      .put(`/api/v1/transactions/update/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: -10 })
      .expect(400);

    const ok = await request(app)
      .put(`/api/v1/transactions/update/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 250, description: "corregido" })
      .expect(200);

    assert.equal(ok.body.amount, 250);
    assert.equal(ok.body.description, "corregido");
  });
});
