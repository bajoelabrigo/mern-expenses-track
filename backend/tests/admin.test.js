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

  test("el admin ve los espacios de cada usuario con su rol", async () => {
    const admin = await createAdmin();
    const usuario = await createUser({ iglesia: "Iglesia Betel" });

    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    const fila = res.body.find((u) => u.username === usuario.user.username);
    const nombres = fila.workspaces.map((w) => w.name).sort();
    assert.deepEqual(nombres, ["Iglesia Betel", "Mis finanzas"]);
    fila.workspaces.forEach((w) => assert.equal(w.role, "propietario"));
  });

  test("el admin lista espacios con miembros y movimientos (sin anulados)", async () => {
    const admin = await createAdmin();
    const usuario = await createUser({ iglesia: "Iglesia Betel" });

    const crear = () =>
      request(app)
        .post("/api/v1/transactions/create")
        .set("Authorization", `Bearer ${usuario.token}`)
        .send({ type: "income", amount: 400, date: "2025-06-10T12:00:00.000Z" })
        .expect(201);

    await crear();
    const segunda = await crear();
    await request(app)
      .post(`/api/v1/transactions/${segunda.body[0]._id}/void`)
      .set("Authorization", `Bearer ${usuario.token}`)
      .expect(200);

    const res = await request(app)
      .get("/api/v1/admin/workspaces")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    const betel = res.body.find((w) => w.name === "Iglesia Betel");
    assert.equal(betel.kind, "iglesia");
    assert.equal(betel.members, 1);
    assert.equal(betel.transactions, 1);
  });

  test("el admin entra como soporte a un espacio ajeno y queda en el historial", async () => {
    const admin = await createAdmin();
    const usuario = await createUser({ iglesia: "Iglesia Betel" });
    const espacio = String(usuario.user.defaultWorkspace);

    const creada = await request(app)
      .post("/api/v1/transactions/create")
      .set("Authorization", `Bearer ${usuario.token}`)
      .send({ type: "expense", amount: 50, date: "2025-06-10T12:00:00.000Z" })
      .expect(201);

    await request(app)
      .put(`/api/v1/transactions/update/${creada.body[0]._id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .set("X-Workspace-Id", espacio)
      .send({ amount: 55 })
      .expect(200);

    const historial = await request(app)
      .get(`/api/v1/workspaces/${espacio}/audit`)
      .set("Authorization", `Bearer ${usuario.token}`)
      .expect(200);

    const edicion = historial.body.entries.find((e) => e.action === "transaction.update");
    assert.equal(edicion.actorName, admin.user.username);
    assert.equal(edicion.before.amount, 50);
    assert.equal(edicion.after.amount, 55);
  });

  test("un usuario normal no entra a espacios ajenos aunque conozca el id", async () => {
    const dueño = await createUser();
    const otro = await createUser();

    await request(app)
      .get(`/api/v1/workspaces/${dueño.user.defaultWorkspace}`)
      .set("Authorization", `Bearer ${otro.token}`)
      .expect(403);
  });
});
