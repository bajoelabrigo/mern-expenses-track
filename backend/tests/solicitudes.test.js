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
const { sentInTests } = require("../utils/mailer");
const JoinRequest = require("../model/JoinRequest");

const as = (method, url, user, workspaceId) => {
  const req = request(app)[method](url).set("Authorization", `Bearer ${user.token}`);
  return workspaceId ? req.set("X-Workspace-Id", String(workspaceId)) : req;
};

//! El pastor tiene la iglesia; `nueva` tiene cuenta propia y quiere entrar
const montar = async (nombreIglesia = "Iglesia Betel") => {
  const pastor = await createUser({ iglesia: nombreIglesia });
  const iglesia = pastor.user.defaultWorkspace;
  const nueva = await createUser();
  return { pastor, iglesia, nueva };
};

const pedir = (nueva, iglesia, message) =>
  as("post", `/api/v1/workspaces/${iglesia}/solicitudes`, nueva).send({ message });

describe("Solicitudes para entrar a una iglesia que ya existe", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(() => {
    sentInTests.length = 0;
    return clearDatabase();
  });

  test("pedir entrar NO da acceso: lo aprueba alguien de dentro", async () => {
    const { pastor, iglesia, nueva } = await montar();

    //! Antes de pedir no puede ni mirar el libro
    await as("get", "/api/v1/transactions/balance", nueva, iglesia).expect(403);

    const res = await pedir(nueva, iglesia, "Soy la tesorera del ministerio").expect(201);
    assert.match(res.body.message, /Iglesia Betel/);

    //! Sigue sin acceso: la solicitud no es una puerta abierta
    await as("get", "/api/v1/transactions/balance", nueva, iglesia).expect(403);

    //! A quien puede aprobar le llega el aviso
    assert.equal(sentInTests.length, 1);
    assert.equal(sentInTests[0].to, pastor.credentials.email);

    const pendientes = await as(
      "get",
      `/api/v1/workspaces/${iglesia}/solicitudes`,
      pastor
    ).expect(200);
    assert.equal(pendientes.body.length, 1);
    assert.equal(pendientes.body[0].email, nueva.credentials.email);
    assert.equal(pendientes.body[0].message, "Soy la tesorera del ministerio");

    //! Aprueba con un rol concreto
    const ok = await as(
      "post",
      `/api/v1/workspaces/${iglesia}/solicitudes/${pendientes.body[0]._id}/aprobar`,
      pastor
    )
      .send({ role: "contador" })
      .expect(200);
    assert.match(ok.body.message, /Iglesia Betel/);
    assert.equal(ok.body.role, "contador");

    //! Ahora sí entra, y con el rol elegido
    await as("get", "/api/v1/transactions/balance", nueva, iglesia).expect(200);
    const miembros = await as("get", `/api/v1/workspaces/${iglesia}/members`, pastor).expect(200);
    const nuevo = miembros.body.find((m) => m.username === nueva.user.username);
    assert.equal(nuevo.role, "contador");

    //! Queda en el historial y la lista de solicitudes se vacía
    const historial = await as("get", `/api/v1/workspaces/${iglesia}/audit`, pastor);
    assert.ok(historial.body.entries.some((e) => e.action === "member.add"));
    const despues = await as("get", `/api/v1/workspaces/${iglesia}/solicitudes`, pastor);
    assert.equal(despues.body.length, 0);
  });

  test("rechazar no da acceso, avisa, y se puede volver a pedir", async () => {
    const { pastor, iglesia, nueva } = await montar();
    await pedir(nueva, iglesia, "").expect(201);

    const pendientes = await as("get", `/api/v1/workspaces/${iglesia}/solicitudes`, pastor);
    sentInTests.length = 0;
    await as(
      "post",
      `/api/v1/workspaces/${iglesia}/solicitudes/${pendientes.body[0]._id}/rechazar`,
      pastor
    ).expect(200);

    await as("get", "/api/v1/transactions/balance", nueva, iglesia).expect(403);
    assert.equal(sentInTests.length, 1);
    assert.equal(sentInTests[0].to, nueva.credentials.email);

    //! No se acumulan: la misma persona puede volver a pedir
    await pedir(nueva, iglesia, "Ahora con más razón").expect(201);
    assert.equal(await JoinRequest.countDocuments({ workspace: iglesia }), 1);
  });

  test("no se pide dos veces ni pide quien ya es miembro", async () => {
    const { pastor, iglesia, nueva } = await montar();

    await pedir(nueva, iglesia, "").expect(201);
    await pedir(nueva, iglesia, "").expect(409);

    //! El pastor sí es miembro: no tiene sentido que pida
    await pedir(pastor, iglesia, "").expect(409);
  });

  test("un lector no ve ni aprueba solicitudes; un tesorero sí, con sus límites", async () => {
    const { pastor, iglesia, nueva } = await montar();
    const lector = await createUser();
    const tesorero = await createUser();

    const invitar = async (quien, role) => {
      const inv = await as("post", `/api/v1/workspaces/${iglesia}/invitations`, pastor)
        .send({ email: quien.credentials.email, role })
        .expect(201);
      const token = inv.body.url.split("/invitacion/")[1];
      await as("post", `/api/v1/invitations/${token}/accept`, quien).expect(200);
    };
    await invitar(lector, "lector");
    await invitar(tesorero, "tesorero");

    const pedir2 = await pedir(nueva, iglesia, "").expect(201);
    void pedir2;

    //! El lector no es de la tesorería
    await as("get", `/api/v1/workspaces/${iglesia}/solicitudes`, lector).expect(403);
    const pendiente = await JoinRequest.findOne({ workspace: iglesia });
    await as(
      "post",
      `/api/v1/workspaces/${iglesia}/solicitudes/${pendiente._id}/aprobar`,
      lector
    )
      .send({ role: "lector" })
      .expect(403);

    //! El tesorero sí, pero no puede nombrar propietario
    await as(
      "post",
      `/api/v1/workspaces/${iglesia}/solicitudes/${pendiente._id}/aprobar`,
      tesorero
    )
      .send({ role: "propietario" })
      .expect(403);
    await as(
      "post",
      `/api/v1/workspaces/${iglesia}/solicitudes/${pendiente._id}/aprobar`,
      tesorero
    )
      .send({ role: "lector" })
      .expect(200);
  });

  test("se ve lo que uno pidió, y se puede retirar (solo lo propio)", async () => {
    const { iglesia, nueva } = await montar();
    const otra = await createUser();

    const creada = await pedir(nueva, iglesia, "Hola").expect(201);

    const mias = await as("get", "/api/v1/workspaces/mis-solicitudes", nueva).expect(200);
    assert.equal(mias.body.length, 1);
    assert.equal(mias.body[0].workspaceName, "Iglesia Betel");

    //! Otro no puede retirar la mía
    await as("delete", `/api/v1/workspaces/solicitudes/${creada.body.request._id}`, otra).expect(404);

    await as("delete", `/api/v1/workspaces/solicitudes/${creada.body.request._id}`, nueva).expect(200);
    const despues = await as("get", "/api/v1/workspaces/mis-solicitudes", nueva).expect(200);
    assert.equal(despues.body.length, 0);
  });

  test("la búsqueda reconoce la iglesia sin tildes ni mayúsculas", async () => {
    const { pastor, iglesia, nueva } = await montar("Ministerio Altísimo");

    const res = await as("get", "/api/v1/workspaces/buscar?nombre=ministerio%20altisimo", nueva)
      .expect(200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].name, "Ministerio Altísimo");
    assert.equal(res.body[0].createdBy, pastor.user.username);
    assert.equal(res.body[0].isMember, false);
    assert.equal(res.body[0].requested, false);

    //! Nada de las cuentas de la iglesia en la respuesta
    assert.deepEqual(Object.keys(res.body[0]).sort(), [
      "_id",
      "createdAt",
      "createdBy",
      "isMember",
      "members",
      "name",
      "requested",
    ]);

    //! Con menos de 3 letras ni se busca
    const corta = await as("get", "/api/v1/workspaces/buscar?nombre=mi", nueva).expect(200);
    assert.deepEqual(corta.body, []);

    //! Y ya pidiendo, la misma búsqueda lo dice
    await pedir(nueva, iglesia, "").expect(201);
    const otra = await as("get", "/api/v1/workspaces/buscar?nombre=altisimo", nueva).expect(200);
    assert.equal(otra.body[0].requested, true);
  });

  test("el aviso del registro dice si el nombre está tomado, sin dar datos", async () => {
    await montar("Iglesia Betel");

    const tomado = await request(app)
      .get("/api/v1/publico/iglesias/existe?nombre=iglesia%20betel")
      .expect(200);
    assert.deepEqual(tomado.body, { existe: true, cuantas: 1 });
    assert.deepEqual(Object.keys(tomado.body).sort(), ["cuantas", "existe"]);

    const libre = await request(app)
      .get("/api/v1/publico/iglesias/existe?nombre=Otra%20Iglesia")
      .expect(200);
    assert.equal(libre.body.existe, false);

    //! Sin nombre suficiente no se responde nada útil
    const corto = await request(app)
      .get("/api/v1/publico/iglesias/existe?nombre=ig")
      .expect(200);
    assert.equal(corto.body.existe, false);
  });
});
