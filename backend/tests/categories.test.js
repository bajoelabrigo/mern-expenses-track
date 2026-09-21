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
      name: "  Pactos ",
      type: "INCOME",
      icon: "💰",
    }).expect(201);

    assert.equal(res.body.name, "pactos");
    assert.equal(res.body.type, "income");
    assert.equal(res.body.icon, "💰");
  });

  test("impide duplicar el nombre para el mismo usuario", async () => {
    const { token } = await createUser();

    await crearCategoria(token, { name: "pactos", type: "income" }).expect(201);
    const res = await crearCategoria(token, {
      name: "Pactos",
      type: "income",
    }).expect(409);

    assert.match(res.body.message, /ya existe/i);
  });

  test("dos usuarios distintos pueden tener la misma categoría", async () => {
    const uno = await createUser();
    const dos = await createUser();

    await crearCategoria(uno.token, { name: "pactos", type: "income" }).expect(201);
    await crearCategoria(dos.token, { name: "pactos", type: "income" }).expect(201);
  });

  test("solo lista las categorías propias", async () => {
    const uno = await createUser();
    const dos = await createUser();

    //! Los dos espacios arrancan con las categorías de fábrica: lo que se mira
    //! es que uno no vea la que creó el otro
    await crearCategoria(uno.token, { name: "solo-de-uno", type: "income" }).expect(201);

    const res = await request(app)
      .get("/api/v1/categories/lists")
      .set("Authorization", `Bearer ${dos.token}`)
      .expect(200);

    assert.equal(res.body.some((c) => c.name === "solo-de-uno"), false);
    assert.ok(res.body.length > 0, "y sí ve las suyas");
  });

  test("renombrar una categoría arrastra las transacciones asociadas", async () => {
    const { token } = await createUser();

    const categoria = await crearCategoria(token, {
      name: "pactos",
      type: "income",
    }).expect(201);

    await crearTransaccion(token, {
      type: "income",
      category: "pactos",
      amount: 100,
      date: "2025-06-10T12:00:00.000Z",
    }).expect(201);

    await request(app)
      .put(`/api/v1/categories/update/${categoria.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Pactos de fe" })
      .expect(200);

    const lista = await request(app)
      .get("/api/v1/transactions/lists")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(lista.body.transactions[0].category, "pactos de fe");
  });

  test("eliminar una categoría reasigna sus transacciones a uncategorized", async () => {
    const { token } = await createUser();

    const categoria = await crearCategoria(token, {
      name: "pintura",
      type: "expense",
    }).expect(201);

    await crearTransaccion(token, {
      type: "expense",
      category: "pintura",
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
      name: "pactos",
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
    await crearCategoria(token, { name: "pintura", type: "expense", incomeKind: "diezmo" }).expect(201);
    const pactos = (await crearCategoria(token, { name: "pactos", type: "income" }).expect(201)).body;
    await crearCategoria(token, { name: "x", type: "income", incomeKind: "limosna" }).expect(400);

    //! El espacio ya trae las de fábrica (diezmos, ofrendas…): aquí se mira lo
    //! que creó esta prueba, que es donde está la deducción del tipo
    const porNombre = Object.fromEntries((await lista()).map((c) => [c.name, c.incomeKind]));
    assert.equal(porNombre["diezmos del mes"], "diezmo");
    assert.equal(porNombre["primícias"], "primicia");
    assert.equal(porNombre["ofrenda especial de aniversario"], "especial");
    assert.equal(porNombre["pactos"], "otro");
    assert.equal(porNombre["pintura"], null);
    assert.equal(porNombre["diezmos"], "diezmo");

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

  test("un espacio nuevo ya trae las categorías para anotar", async () => {
    const { token } = await createUser({ iglesia: "Iglesia Betel" });

    const lista = (
      await request(app).get("/api/v1/categories/lists").set("Authorization", `Bearer ${token}`).expect(200)
    ).body;

    const nombres = lista.map((c) => c.name);
    //! Las de ingreso, con su tipo: son las que hacen que los informes separen
    //! diezmos de ofrendas
    for (const esperada of ["diezmos", "ofrendas", "primicias", "ofrenda especial"]) {
      assert.ok(nombres.includes(esperada), `falta la categoría de ingreso "${esperada}"`);
    }
    assert.equal(lista.find((c) => c.name === "diezmos").incomeKind, "diezmo");
    assert.equal(lista.find((c) => c.name === "ofrenda especial").incomeKind, "especial");

    //! Y las de gasto de una iglesia
    for (const esperada of ["servicios", "alquiler", "honorarios", "mantenimiento", "actividades", "ayuda social"]) {
      assert.ok(nombres.includes(esperada), `falta la categoría de gasto "${esperada}"`);
    }

    //! Y se puede anotar la primera ofrenda sin tocar nada más
    await crearTransaccion(token, {
      type: "income",
      category: "ofrendas",
      amount: 275.5,
      date: "2026-09-20T12:00:00.000Z",
    }).expect(201);
  });

  test("el espacio personal trae las suyas, no las de iglesia", async () => {
    const user = await createUser();

    const espacios = (
      await request(app).get("/api/v1/workspaces").set("Authorization", `Bearer ${user.token}`).expect(200)
    ).body;
    const personal = espacios.find((e) => e.kind === "personal");

    const lista = (
      await request(app)
        .get("/api/v1/categories/lists")
        .set("Authorization", `Bearer ${user.token}`)
        .set("X-Workspace-Id", String(personal._id))
        .expect(200)
    ).body;

    const nombres = lista.map((c) => c.name);
    assert.ok(nombres.includes("comida"));
    assert.ok(nombres.includes("sueldo"));
    assert.equal(nombres.includes("diezmos"), false);
  });

  test("reponer las de fábrica repone la que falta y no duplica nada", async () => {
    const { token } = await createUser({ iglesia: "Iglesia Betel" });
    const reponer = () =>
      request(app).post("/api/v1/categories/defaults").set("Authorization", `Bearer ${token}`);
    const nombres = async () =>
      (
        await request(app).get("/api/v1/categories/lists").set("Authorization", `Bearer ${token}`).expect(200)
      ).body.map((c) => c.name);

    //! Con todas puestas no agrega nada
    const conTodo = await reponer().expect(200);
    assert.equal(conTodo.body.added.length, 0);

    //! Si alguien borra una, vuelve
    const prima = (
      await request(app).get("/api/v1/categories/lists").set("Authorization", `Bearer ${token}`).expect(200)
    ).body.find((c) => c.name === "primicias");
    await request(app)
      .delete(`/api/v1/categories/delete/${prima._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    assert.equal((await nombres()).includes("primicias"), false);

    const repuesta = await reponer().expect(201);
    assert.deepEqual(repuesta.body.added.map((c) => c.name), ["primicias"]);
    assert.equal((await nombres()).includes("primicias"), true);
  });

  test("el nombre viejo de la ruta sigue funcionando", async () => {
    //! Las apps que ya estaban abiertas en un teléfono piden esta hasta que se
    //! actualicen solas
    const { token } = await createUser({ iglesia: "Iglesia Betel" });

    await request(app)
      .post("/api/v1/categories/church-defaults")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });
});
