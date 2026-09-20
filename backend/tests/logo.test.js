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
const { setLogoStorage } = require("../services/logoStorage");

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

//! Un PNG de 1x1 de verdad: la subida comprueba los primeros bytes
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]);

//! Almacenamiento falso: registra lo subido y lo borrado, sin tocar Cloudinary
const fakeStorage = () => {
  const state = { uploads: [], destroyed: [], fetched: [], configured: true, fetchFails: false };
  let n = 0;
  state.impl = {
    isConfigured: () => state.configured,
    upload: async ({ buffer, workspaceId }) => {
      n += 1;
      state.uploads.push({ bytes: buffer.length, workspaceId: String(workspaceId) });
      return {
        publicId: `control-gastos/logos/${workspaceId}`,
        url: `https://ejemplo.test/logo-${workspaceId}-v${n}.png`,
        width: 400,
        height: 200,
        bytes: buffer.length,
      };
    },
    destroy: async ({ publicId }) => {
      state.destroyed.push(publicId);
    },
    fetchBytes: async (url) => {
      state.fetched.push(url);
      if (state.fetchFails) throw new Error("no se pudo bajar");
      return PNG;
    },
  };
  return state;
};

const pdf = (url, user, ws) =>
  as("get", url, user, ws)
    .buffer()
    .parse((res, cb) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(Buffer.from(c)));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });

describe("Logo del espacio", () => {
  let storage;

  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(async () => {
    storage = fakeStorage();
    setLogoStorage(storage.impl);
    await clearDatabase();
  });

  test("el propietario sube el logo y la app solo devuelve su dirección", async () => {
    const { pastor, ws } = await iglesia();

    const res = await as("put", `/api/v1/workspaces/${ws}/logo`, pastor, ws)
      .attach("logo", PNG, { filename: "logo.png", contentType: "image/png" })
      .expect(200);

    assert.match(res.body.logo, /^https:\/\/ejemplo\.test\/logo-/);
    //! Ni el id interno ni el tamaño salen de la API
    assert.equal(res.body.publicId, undefined);
    assert.equal(storage.uploads.length, 1);
    assert.equal(storage.uploads[0].workspaceId, String(ws));

    //! Y viene en la lista de espacios, para pintarlo en la app
    const espacios = (await as("get", "/api/v1/workspaces", pastor).expect(200)).body;
    assert.match(espacios.find((e) => String(e._id) === String(ws)).logo, /ejemplo\.test/);
  });

  test("solo valen PNG y JPG, que son los que caben en un PDF", async () => {
    const { pastor, ws } = await iglesia();
    const url = `/api/v1/workspaces/${ws}/logo`;

    await as("put", url, pastor, ws).expect(400);

    //! Un WEBP es una imagen válida, pero pdfkit no sabe incrustarla
    const webp = Buffer.concat([
      Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(30),
    ]);
    await as("put", url, pastor, ws)
      .attach("logo", webp, { filename: "logo.webp", contentType: "image/webp" })
      .expect(400);

    //! Y un archivo que dice ser PNG pero no lo es
    await as("put", url, pastor, ws)
      .attach("logo", Buffer.from("esto no es una imagen"), {
        filename: "logo.png",
        contentType: "image/png",
      })
      .expect(400);

    await as("put", url, pastor, ws)
      .attach("logo", JPG, { filename: "logo.jpg", contentType: "image/jpeg" })
      .expect(200);
    assert.equal(storage.uploads.length, 1);
  });

  test("quien no manda el espacio no puede cambiar el logo", async () => {
    const { pastor, ws } = await iglesia();
    const tesorero = await createUser();
    await invitarYAceptar(pastor, ws, tesorero, "tesorero");

    await as("put", `/api/v1/workspaces/${ws}/logo`, tesorero, ws)
      .attach("logo", PNG, { filename: "logo.png", contentType: "image/png" })
      .expect(403);
    assert.equal(storage.uploads.length, 0);
  });

  test("quitar el logo lo borra de la nube y del espacio", async () => {
    const { pastor, ws } = await iglesia();
    const url = `/api/v1/workspaces/${ws}/logo`;

    //! Sin logo no hay nada que quitar
    await as("delete", url, pastor, ws).expect(404);

    await as("put", url, pastor, ws)
      .attach("logo", PNG, { filename: "logo.png", contentType: "image/png" })
      .expect(200);

    const res = await as("delete", url, pastor, ws).expect(200);
    assert.equal(res.body.logo, "");
    assert.deepEqual(storage.destroyed, [`control-gastos/logos/${ws}`]);
  });

  test("el logo sale impreso en los informes, y si falla la descarga el informe igual sale", async () => {
    const { pastor, ws } = await iglesia();
    await as("post", "/api/v1/transactions/create", pastor, ws)
      .send({ type: "income", category: "diezmos", amount: 100, date: "2026-06-10" })
      .expect(201);

    //! Sin logo no se intenta bajar nada
    await pdf("/api/v1/reports/mensual?year=2026&month=6", pastor, ws).expect(200);
    assert.equal(storage.fetched.length, 0);

    await as("put", `/api/v1/workspaces/${ws}/logo`, pastor, ws)
      .attach("logo", PNG, { filename: "logo.png", contentType: "image/png" })
      .expect(200);

    const conLogo = await pdf("/api/v1/reports/mensual?year=2026&month=6", pastor, ws).expect(200);
    assert.ok(conLogo.body.toString("latin1").startsWith("%PDF"));
    assert.equal(storage.fetched.length, 1, "se bajó el logo una vez");

    //! La segunda vez sale de la memoria, no se vuelve a bajar
    await pdf("/api/v1/reports/anual?year=2026", pastor, ws).expect(200);
    assert.equal(storage.fetched.length, 1, "la segunda vez no se vuelve a bajar");

    //! Y si la nube falla, el informe sale igual (sin logo)
    setLogoStorage({ ...storage.impl, fetchBytes: async () => { throw new Error("caída"); } });
    const sinNube = await pdf("/api/v1/reports/mensual?year=2026&month=6", pastor, ws).expect(200);
    assert.ok(sinNube.body.toString("latin1").startsWith("%PDF"));
  });
});
