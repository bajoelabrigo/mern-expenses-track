const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  app,
  request,
  mongoose,
  setupDatabase,
  teardownDatabase,
  clearDatabase,
} = require("./helpers");
const { migrate } = require("../scripts/migrar-espacios");

const col = (name) => mongoose.connection.collection(name);

//! Inserta datos con la forma que tienen HOY en producción (antes de la fase 1)
const seedLegacy = async () => {
  const password = await bcrypt.hash("Password123", 4);
  const pastorId = new mongoose.Types.ObjectId();
  const personalId = new mongoose.Types.ObjectId();

  await col("users").insertMany([
    {
      _id: pastorId,
      username: "pastor",
      email: "pastor@test.com",
      password,
      iglesia: "Iglesia Betel",
      role: "user",
    },
    //! Un usuario antiguo sin iglesia (no debería existir, pero por si acaso)
    { _id: personalId, username: "sinIglesia", email: "si@test.com", password, role: "user" },
  ]);

  await col("categories").insertMany([
    { user: pastorId, name: "diezmos", type: "income", icon: "💰" },
    { user: personalId, name: "comida", type: "expense", icon: "🍞" },
  ]);

  await col("transactions").insertMany([
    { user: pastorId, type: "income", category: "diezmos", amount: 0.1, date: new Date("2025-06-01") },
    { user: pastorId, type: "income", category: "diezmos", amount: 0.2, date: new Date("2025-06-02") },
    { user: pastorId, type: "expense", category: "luz", amount: 45.5, date: new Date("2025-06-03") },
    { user: personalId, type: "expense", category: "comida", amount: 12.35, date: new Date("2025-06-04") },
    //! Movimiento de un usuario que ya no existe
    { user: new mongoose.Types.ObjectId(), type: "income", amount: 5, date: new Date() },
  ]);

  //! Índice viejo que chocaría con dos iglesias que usan el mismo nombre
  await col("categories").createIndex({ user: 1, name: 1 }, { unique: true });

  return { pastorId, personalId };
};

describe("Migración a espacios", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(async () => {
    await clearDatabase();
    //! clearDatabase borra documentos, no índices: se quitan los que dejó
    //! la prueba anterior para empezar como en producción
    for (const name of ["categories", "transactions"]) {
      await col(name).dropIndexes().catch(() => {});
    }
  });

  test("la simulación no escribe nada", async () => {
    await seedLegacy();

    const summary = await migrate({ apply: false, log: () => {} });

    assert.equal(summary.users, 2);
    assert.equal(summary.workspacesCreated, 3);
    assert.equal(summary.transactionsMoved, 4);
    assert.equal(summary.amountsConverted, 5);
    assert.equal(await col("workspaces").countDocuments(), 0);
    assert.equal(await col("transactions").countDocuments({ amountCents: { $exists: true } }), 0);
  });

  test("migra usuarios, movimientos, categorías, centavos e índices", async () => {
    const { pastorId, personalId } = await seedLegacy();
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "migracion-"));

    const summary = await migrate({ apply: true, backupDir, log: () => {} });

    assert.equal(summary.workspacesCreated, 3);
    assert.equal(summary.transactionsMoved, 4);
    assert.equal(summary.categoriesMoved, 2);
    assert.equal(summary.amountsConverted, 5);
    assert.equal(summary.orphanTransactions, 1);
    assert.ok(fs.existsSync(summary.backupFile));
    const backup = JSON.parse(fs.readFileSync(summary.backupFile, "utf8"));
    assert.equal(backup.transactions.length, 5);

    const pastor = await col("users").findOne({ _id: pastorId });
    const iglesia = await col("workspaces").findOne({ _id: pastor.defaultWorkspace });
    assert.equal(iglesia.name, "Iglesia Betel");
    assert.equal(iglesia.kind, "iglesia");

    const txPastor = await col("transactions").find({ workspace: iglesia._id }).toArray();
    assert.equal(txPastor.length, 3);
    txPastor.forEach((tx) => {
      assert.equal(tx.user, undefined);
      assert.equal(tx.amount, undefined);
      assert.equal(String(tx.createdBy), String(pastorId));
      assert.ok(Number.isInteger(tx.amountCents));
    });
    assert.deepEqual(txPastor.map((t) => t.amountCents).sort((a, b) => a - b), [10, 20, 4550]);

    //! Sin iglesia: sus datos van a su espacio personal
    const sinIglesia = await col("users").findOne({ _id: personalId });
    const suyo = await col("workspaces").findOne({ _id: sinIglesia.defaultWorkspace });
    assert.equal(suyo.kind, "personal");
    assert.equal(await col("categories").countDocuments({ workspace: suyo._id }), 1);

    const indices = (await col("categories").indexes()).map((i) => i.name);
    assert.ok(!indices.includes("user_1_name_1"));
    assert.ok(indices.includes("workspace_1_name_1"));

    fs.rmSync(backupDir, { recursive: true, force: true });
  });

  test("ejecutarla dos veces no duplica nada", async () => {
    await seedLegacy();
    await migrate({ apply: true, log: () => {} });
    const segunda = await migrate({ apply: true, log: () => {} });

    assert.equal(segunda.workspacesCreated, 0);
    assert.equal(segunda.transactionsMoved, 0);
    assert.equal(segunda.amountsConverted, 0);
    assert.equal(await col("workspaces").countDocuments(), 3);
    assert.equal(await col("memberships").countDocuments(), 3);
  });

  test("tras migrar, una sesión abierta antes sigue funcionando y ve sus libros", async () => {
    const { pastorId } = await seedLegacy();
    await migrate({ apply: true, log: () => {} });

    //! Token con la forma que emitía la versión anterior (sin "v")
    const legacyToken = jwt.sign({ id: pastorId, role: "user" }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const balance = await request(app)
      .get("/api/v1/transactions/balance")
      .set("Authorization", `Bearer ${legacyToken}`)
      .expect(200);

    assert.equal(balance.body.income, 0.3);
    assert.equal(balance.body.expense, 45.5);

    const cats = await request(app)
      .get("/api/v1/categories/lists")
      .set("Authorization", `Bearer ${legacyToken}`)
      .expect(200);
    assert.deepEqual(cats.body.map((c) => c.name), ["diezmos"]);

    //! Y el login normal también
    await request(app)
      .post("/api/v1/users/login")
      .send({ email: "pastor@test.com", password: "Password123" })
      .expect(200);
  });
});
