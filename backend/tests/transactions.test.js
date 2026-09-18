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

    await request(app)
      .get(`/api/v1/transactions/${id}`)
      .set("Authorization", `Bearer ${intruso.token}`)
      .expect(404);

    await request(app)
      .put(`/api/v1/transactions/update/${id}`)
      .set("Authorization", `Bearer ${intruso.token}`)
      .send({ amount: 99999 })
      .expect(403);

    await request(app)
      .delete(`/api/v1/transactions/delete/${id}`)
      .set("Authorization", `Bearer ${intruso.token}`)
      .expect(403);

    const listado = await request(app)
      .get("/api/v1/transactions/lists")
      .set("Authorization", `Bearer ${intruso.token}`)
      .expect(200);

    assert.equal(listado.body.total, 0);
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
