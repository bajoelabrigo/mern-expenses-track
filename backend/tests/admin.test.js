const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  app,
  request,
  setupDatabase,
  teardownDatabase,
  clearDatabase,
  createUser,
  promoteToAdmin,
} = require("./helpers");

//! Crea un admin autenticado (el rol se lee de la BD en cada request)
const createAdmin = async () => {
  const admin = await createUser();
  await promoteToAdmin(admin.user.id);
  const login = await request(app)
    .post("/api/v1/users/login")
    .send({
      email: admin.credentials.email,
      password: admin.credentials.password,
    })
    .expect(200);
  return { ...admin, token: login.body.token };
};

describe("Panel de administración", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("un usuario normal no accede a las rutas de admin", async () => {
    const { token } = await createUser();

    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    assert.match(res.body.message, /administradores/i);
  });

  test("sin token las rutas de admin responden 401", async () => {
    await request(app).get("/api/v1/admin/users").expect(401);
  });

  test("el admin lista usuarios sin exponer contraseñas", async () => {
    const admin = await createAdmin();
    await createUser();

    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    assert.ok(res.body.length >= 2);
    res.body.forEach((u) => {
      assert.equal(u.password, undefined);
      assert.ok(u.username, "cada usuario debe traer username");
    });
  });

  test("el dashboard de un usuario trae transacciones, categorías y totales", async () => {
    const admin = await createAdmin();
    const usuario = await createUser();

    await request(app)
      .post("/api/v1/transactions/create")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({
        type: "income",
        category: "diezmos",
        amount: 400,
        date: "2025-06-10T12:00:00.000Z",
      })
      .expect(201);

    await request(app)
      .post("/api/v1/categories/create")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({ name: "diezmos", type: "income" })
      .expect(201);

    const res = await request(app)
      .get(`/api/v1/admin/dashboard/${usuario.user.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    assert.equal(res.body.transactions.length, 1);
    assert.equal(res.body.categories.length, 1);
    assert.equal(res.body.totals.income, 400);
    assert.equal(res.body.totals.balance, 400);
    assert.equal(res.body.user.email, usuario.user.email);
    assert.equal(res.body.user.password, undefined);
  });

  test("renombrar una categoría desde el admin actualiza las transacciones del usuario", async () => {
    const admin = await createAdmin();
    const usuario = await createUser();

    const categoria = await request(app)
      .post("/api/v1/categories/create")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({ name: "ofrendas", type: "income" })
      .expect(201);

    await request(app)
      .post("/api/v1/transactions/create")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({
        type: "income",
        category: "ofrendas",
        amount: 80,
        date: "2025-06-10T12:00:00.000Z",
      })
      .expect(201);

    await request(app)
      .put(`/api/v1/admin/categories/${categoria.body._id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Ofrendas especiales" })
      .expect(200);

    const lista = await request(app)
      .get("/api/v1/transactions/lists")
      .set("Authorization", `Bearer ${usuario.token}`)
      .expect(200);

    assert.equal(
      lista.body.transactions[0].category,
      "ofrendas especiales",
      "la transacción debe quedar con el nombre nuevo"
    );
  });

  test("eliminar una categoría desde el admin reasigna las transacciones", async () => {
    const admin = await createAdmin();
    const usuario = await createUser();

    const categoria = await request(app)
      .post("/api/v1/categories/create")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({ name: "mantenimiento", type: "expense" })
      .expect(201);

    await request(app)
      .post("/api/v1/transactions/create")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({
        type: "expense",
        category: "mantenimiento",
        amount: 45,
        date: "2025-06-10T12:00:00.000Z",
      })
      .expect(201);

    await request(app)
      .delete(`/api/v1/admin/categories/${categoria.body._id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    const lista = await request(app)
      .get("/api/v1/transactions/lists")
      .set("Authorization", `Bearer ${usuario.token}`)
      .expect(200);

    assert.equal(lista.body.transactions[0].category, "uncategorized");
  });

  test("el admin edita y elimina transacciones de otros usuarios", async () => {
    const admin = await createAdmin();
    const usuario = await createUser();

    const creada = await request(app)
      .post("/api/v1/transactions/create")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({
        type: "expense",
        category: "servicios",
        amount: 30,
        date: "2025-06-10T12:00:00.000Z",
      })
      .expect(201);

    const id = creada.body[0]._id;

    const editada = await request(app)
      .put(`/api/v1/admin/transactions/${id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ amount: 55 })
      .expect(200);

    assert.equal(editada.body.amount, 55);

    await request(app)
      .delete(`/api/v1/admin/transactions/${id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    const lista = await request(app)
      .get("/api/v1/transactions/lists")
      .set("Authorization", `Bearer ${usuario.token}`)
      .expect(200);

    assert.equal(lista.body.total, 0);
  });

  test("el admin recibe 400 ante un id con formato inválido", async () => {
    const admin = await createAdmin();

    await request(app)
      .get("/api/v1/admin/dashboard/no-valido")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(400);
  });

  test("si el rol cambia en la base de datos, el token viejo pierde el acceso", async () => {
    const admin = await createAdmin();
    const User = require("../model/User");

    await User.findByIdAndUpdate(admin.user.id, { role: "user" });

    await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(403);
  });
});
