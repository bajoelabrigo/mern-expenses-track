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
const { setReceiptStorage } = require("../services/receiptStorage");

//! Almacenamiento falso: registra lo que se sube y lo que se borra
const fakeStorage = () => {
  const state = { uploads: [], destroyed: [], destroyedWorkspaces: [], configured: true };
  let n = 0;
  state.impl = {
    isConfigured: () => state.configured,
    upload: async ({ buffer, mimetype, workspaceId }) => {
      n += 1;
      state.uploads.push({ bytes: buffer.length, mimetype, workspaceId });
      const raw = mimetype === "application/pdf";
      return {
        publicId: `control-gastos/${workspaceId}/r${n}`,
        resourceType: raw ? "raw" : "image",
        format: raw ? "pdf" : "jpg",
        bytes: buffer.length,
      };
    },
    viewUrl: ({ publicId }) => `https://firmado.example/${publicId}?expira=300`,
    destroy: async ({ publicId }) => state.destroyed.push(publicId),
    destroyWorkspace: async (id) => state.destroyedWorkspaces.push(id),
  };
  return state;
};

//! Archivos mínimos con la firma correcta
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const PDF = Buffer.from("%PDF-1.4\n% comprobante de prueba\n");

const as = (method, url, user, workspaceId) => {
  const req = request(app)[method](url).set("Authorization", `Bearer ${user.token}`);
  return workspaceId ? req.set("X-Workspace-Id", String(workspaceId)) : req;
};

const nuevoMovimiento = async (user, workspaceId) =>
  (
    await as("post", "/api/v1/transactions/create", user, workspaceId)
      .send({ type: "expense", amount: 40, date: "2026-09-10" })
      .expect(201)
  ).body[0]._id;

const adjuntar = (user, id, buffer, filename, contentType, workspaceId) =>
  as("put", `/api/v1/transactions/${id}/receipt`, user, workspaceId).attach(
    "receipt",
    buffer,
    { filename, contentType }
  );

describe("Comprobantes", () => {
  let storage;

  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(async () => {
    storage = fakeStorage();
    setReceiptStorage(storage.impl);
    await clearDatabase();
  });

  test("adjunta una foto al movimiento sin exponer dónde está guardada", async () => {
    const user = await createUser();
    const id = await nuevoMovimiento(user);

    const res = await adjuntar(user, id, JPEG, "ticket.jpg", "image/jpeg").expect(200);

    assert.equal(res.body.receipt.format, "jpg");
    assert.equal(res.body.receipt.publicId, undefined);
    assert.equal(storage.uploads.length, 1);
    assert.equal(storage.uploads[0].workspaceId, String(user.user.defaultWorkspace));

    //! Y el listado dice que lo tiene
    const lista = await as("get", "/api/v1/transactions/lists", user);
    assert.equal(lista.body.transactions[0].receipt.format, "jpg");
  });

  test("reemplazar borra el anterior (después de guardar el nuevo)", async () => {
    const user = await createUser();
    const id = await nuevoMovimiento(user);

    await adjuntar(user, id, JPEG, "a.jpg", "image/jpeg").expect(200);
    await adjuntar(user, id, PDF, "b.pdf", "application/pdf").expect(200);

    assert.equal(storage.uploads.length, 2);
    assert.deepEqual(storage.destroyed, [`control-gastos/${user.user.defaultWorkspace}/r1`]);
  });

  test("ver da un enlace firmado; un lector puede verlo pero no adjuntar", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const lector = await createUser();
    const espacio = pastor.user.defaultWorkspace;
    const inv = await as("post", `/api/v1/workspaces/${espacio}/invitations`, pastor)
      .send({ email: lector.credentials.email, role: "lector" })
      .expect(201);
    await as("post", `/api/v1/invitations/${inv.body.url.split("/invitacion/")[1]}/accept`, lector)
      .expect(200);

    const id = await nuevoMovimiento(pastor, espacio);
    await adjuntar(pastor, id, JPEG, "t.jpg", "image/jpeg", espacio).expect(200);

    const ver = await as("get", `/api/v1/transactions/${id}/receipt`, lector, espacio).expect(200);
    assert.match(ver.body.url, /^https:\/\/firmado\.example\/.+expira=300$/);

    await adjuntar(lector, id, JPEG, "t.jpg", "image/jpeg", espacio).expect(403);
    await as("delete", `/api/v1/transactions/${id}/receipt`, lector, espacio).expect(403);
  });

  test("desde otro espacio no se puede ver ni adjuntar", async () => {
    const dueño = await createUser();
    const intruso = await createUser();
    const id = await nuevoMovimiento(dueño);
    await adjuntar(dueño, id, JPEG, "t.jpg", "image/jpeg").expect(200);

    await as("get", `/api/v1/transactions/${id}/receipt`, intruso).expect(404);
    await adjuntar(intruso, id, JPEG, "t.jpg", "image/jpeg").expect(404);
  });

  test("rechaza lo que no es imagen o PDF aunque diga que lo es", async () => {
    const user = await createUser();
    const id = await nuevoMovimiento(user);

    //! Texto con tipo "image/jpeg": la firma no coincide
    await adjuntar(user, id, Buffer.from("<script>alert(1)</script>"), "x.jpg", "image/jpeg")
      .expect(400);
    //! Tipo no admitido
    await adjuntar(user, id, Buffer.from("MZ\x90\x00"), "x.exe", "application/octet-stream")
      .expect(400);
    //! Sin archivo
    await as("put", `/api/v1/transactions/${id}/receipt`, user).expect(400);
    //! Demasiado grande
    const grande = Buffer.concat([JPEG, Buffer.alloc(9 * 1024 * 1024)]);
    await adjuntar(user, id, grande, "g.jpg", "image/jpeg").expect(413);

    assert.equal(storage.uploads.length, 0);
  });

  test("no se adjunta a un movimiento anulado", async () => {
    const user = await createUser();
    const id = await nuevoMovimiento(user);
    await as("post", `/api/v1/transactions/${id}/void`, user).expect(200);

    await adjuntar(user, id, JPEG, "t.jpg", "image/jpeg").expect(409);
  });

  test("quitar el comprobante lo borra de Cloudinary y queda en el historial", async () => {
    const user = await createUser();
    const id = await nuevoMovimiento(user);
    await adjuntar(user, id, JPEG, "t.jpg", "image/jpeg").expect(200);

    await as("delete", `/api/v1/transactions/${id}/receipt`, user).expect(200);

    assert.equal(storage.destroyed.length, 1);
    await as("get", `/api/v1/transactions/${id}/receipt`, user).expect(404);

    const historial = await as(
      "get",
      `/api/v1/workspaces/${user.user.defaultWorkspace}/audit?entityId=${id}`,
      user
    );
    const acciones = historial.body.entries.map((e) => e.action);
    assert.ok(acciones.includes("receipt.attach"));
    assert.ok(acciones.includes("receipt.remove"));
  });

  test("borrar del todo el movimiento o el espacio se lleva los comprobantes", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const espacio = pastor.user.defaultWorkspace;
    const id = await nuevoMovimiento(pastor, espacio);
    await adjuntar(pastor, id, JPEG, "t.jpg", "image/jpeg", espacio).expect(200);

    await as("delete", `/api/v1/transactions/${id}/purge`, pastor, espacio).expect(200);
    assert.equal(storage.destroyed.length, 1);

    await as("delete", `/api/v1/workspaces/${espacio}`, pastor)
      .send({ confirmName: "Iglesia Betel" })
      .expect(200);
    assert.deepEqual(storage.destroyedWorkspaces, [String(espacio)]);
  });

  test("sin Cloudinary configurado responde 503 en vez de fallar", async () => {
    storage.configured = false;
    const user = await createUser();
    const id = await nuevoMovimiento(user);

    const res = await adjuntar(user, id, JPEG, "t.jpg", "image/jpeg").expect(503);
    assert.match(res.body.message, /no están disponibles/);
  });
});
