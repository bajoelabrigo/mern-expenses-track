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

const crearCategoria = (token, payload) =>
  request(app)
    .post("/api/v1/categories/create")
    .set("Authorization", `Bearer ${token}`)
    .send(payload);

const crearTransaccion = (token, payload) =>
  request(app)
    .post("/api/v1/transactions/create")
    .set("Authorization", `Bearer ${token}`)
    .send(payload);

describe("Categorías", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("crea una categoría normalizando nombre y tipo", async () => {
    const { token } = await createUser();

    const res = await crearCategoria(token, {
      name: "  Diezmos ",
      type: "INCOME",
      icon: "💰",
    }).expect(201);

    assert.equal(res.body.name, "diezmos");
    assert.equal(res.body.type, "income");
    assert.equal(res.body.icon, "💰");
  });

  test("impide duplicar el nombre para el mismo usuario", async () => {
    const { token } = await createUser();

    await crearCategoria(token, { name: "diezmos", type: "income" }).expect(201);
    const res = await crearCategoria(token, {
      name: "Diezmos",
      type: "income",
    }).expect(409);

    assert.match(res.body.message, /ya existe/i);
  });

  test("dos usuarios distintos pueden tener la misma categoría", async () => {
    const uno = await createUser();
    const dos = await createUser();

    await crearCategoria(uno.token, { name: "diezmos", type: "income" }).expect(201);
    await crearCategoria(dos.token, { name: "diezmos", type: "income" }).expect(201);
  });

  test("solo lista las categorías propias", async () => {
    const uno = await createUser();
    const dos = await createUser();

    await crearCategoria(uno.token, { name: "diezmos", type: "income" }).expect(201);

    const res = await request(app)
      .get("/api/v1/categories/lists")
      .set("Authorization", `Bearer ${dos.token}`)
      .expect(200);

    assert.equal(res.body.length, 0);
  });

  test("renombrar una categoría arrastra las transacciones asociadas", async () => {
    const { token } = await createUser();

    const categoria = await crearCategoria(token, {
      name: "diezmos",
      type: "income",
    }).expect(201);

    await crearTransaccion(token, {
      type: "income",
      category: "diezmos",
      amount: 100,
      date: "2025-06-10T12:00:00.000Z",
    }).expect(201);

    await request(app)
      .put(`/api/v1/categories/update/${categoria.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Diezmos y primicias" })
      .expect(200);

    const lista = await request(app)
      .get("/api/v1/transactions/lists")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(lista.body.transactions[0].category, "diezmos y primicias");
  });

  test("eliminar una categoría reasigna sus transacciones a uncategorized", async () => {
    const { token } = await createUser();

    const categoria = await crearCategoria(token, {
      name: "servicios",
      type: "expense",
    }).expect(201);

    await crearTransaccion(token, {
      type: "expense",
      category: "servicios",
      amount: 60,
      date: "2025-06-10T12:00:00.000Z",
    }).expect(201);

    await request(app)
      .delete(`/api/v1/categories/delete/${categoria.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const lista = await request(app)
      .get("/api/v1/transactions/lists")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(lista.body.transactions[0].category, "uncategorized");
  });

  test("un usuario no puede editar ni borrar categorías ajenas", async () => {
    const dueño = await createUser();
    const intruso = await createUser();

    const categoria = await crearCategoria(dueño.token, {
      name: "diezmos",
      type: "income",
    }).expect(201);

    await request(app)
      .get(`/api/v1/categories/${categoria.body._id}`)
      .set("Authorization", `Bearer ${intruso.token}`)
      .expect(404);

    await request(app)
      .put(`/api/v1/categories/update/${categoria.body._id}`)
      .set("Authorization", `Bearer ${intruso.token}`)
      .send({ name: "hackeada" })
      .expect(404);

    await request(app)
      .delete(`/api/v1/categories/delete/${categoria.body._id}`)
      .set("Authorization", `Bearer ${intruso.token}`)
      .expect(404);

    //! Pedir el espacio del dueño por la cabecera tampoco sirve
    await request(app)
      .get("/api/v1/categories/lists")
      .set("Authorization", `Bearer ${intruso.token}`)
      .set("X-Workspace-Id", String(dueño.user.defaultWorkspace))
      .expect(403);
  });

  test("valida el tipo de categoría", async () => {
    const { token } = await createUser();

    await crearCategoria(token, { name: "rara", type: "inversion" }).expect(400);
  });

  test("un id inválido responde 400", async () => {
    const { token } = await createUser();

    await request(app)
      .get("/api/v1/categories/12345")
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
  });

  test("las de ingreso tienen tipo: deducido del nombre o elegido a mano", async () => {
    const { token } = await createUser();
    const lista = async () =>
      (await request(app).get("/api/v1/categories/lists").set("Authorization", `Bearer ${token}`).expect(200)).body;

    await crearCategoria(token, { name: "Diezmos del mes", type: "income" }).expect(201);
    await crearCategoria(token, { name: "Primícias", type: "income" }).expect(201);
    await crearCategoria(token, { name: "Ofrenda especial de aniversario", type: "income" }).expect(201);
    await crearCategoria(token, { name: "ofrendas", type: "income" }).expect(201);
    await crearCategoria(token, { name: "alquiler", type: "expense", incomeKind: "diezmo" }).expect(201);
    const pactos = (await crearCategoria(token, { name: "pactos", type: "income" }).expect(201)).body;
    await crearCategoria(token, { name: "x", type: "income", incomeKind: "limosna" }).expect(400);

    const porNombre = Object.fromEntries((await lista()).map((c) => [c.name, c.incomeKind]));
    assert.deepEqual(porNombre, {
      "alquiler": null,
      "diezmos del mes": "diezmo",
      "ofrenda especial de aniversario": "especial",
      "ofrendas": "ofrenda",
      "pactos": "otro",
      "primícias": "primicia",
    });

    //! Elegido a mano queda guardado; con null vuelve a deducirse
    const put = (body) =>
      request(app)
        .put(`/api/v1/categories/update/${pactos._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(body);
    assert.equal((await put({ incomeKind: "especial" }).expect(200)).body.incomeKind, "especial");
    assert.equal((await put({ name: "pactos de fe" }).expect(200)).body.incomeKind, "especial");
    assert.equal((await put({ incomeKind: null }).expect(200)).body.incomeKind, "otro");
    //! Si pasa a ser de gasto, deja de tener tipo de ingreso
    assert.equal((await put({ type: "expense", incomeKind: "diezmo" }).expect(200)).body.incomeKind, null);
  });

  test("agrega las categorías base de iglesia que faltan, sin duplicar", async () => {
    const { token } = await createUser({ iglesia: "Iglesia Betel" });
    const base = () =>
      request(app).post("/api/v1/categories/church-defaults").set("Authorization", `Bearer ${token}`);

    //! "Diezmo" en singular ya cubre los diezmos
    await crearCategoria(token, { name: "Diezmo", type: "income" }).expect(201);

    const primera = await base().expect(201);
    assert.deepEqual(primera.body.added.map((c) => c.name), ["ofrendas", "primicias", "ofrenda especial"]);
    assert.deepEqual(primera.body.added.map((c) => c.incomeKind), ["ofrenda", "primicia", "especial"]);

    const segunda = await base().expect(200);
    assert.equal(segunda.body.added.length, 0);
  });
});
