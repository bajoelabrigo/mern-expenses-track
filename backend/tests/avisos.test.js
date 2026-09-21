const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  app,
  request,
  setupDatabase,
  teardownDatabase,
  clearDatabase,
  createUser,
  hoy,
} = require("./helpers");
const { describir } = require("../services/notificationService");
const PushSubscription = require("../model/PushSubscription");
const push = require("../services/pushService");

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

const avisos = async (user, ws) => (await as("get", "/api/v1/avisos", user, ws).expect(200)).body;

const leidos = (user, ws) => as("post", "/api/v1/avisos/leidas", user, ws).expect(200);

const gasto = (user, ws, body = {}) =>
  as("post", "/api/v1/transactions/create", user, ws)
    .send({ type: "expense", category: "servicios", amount: 280, date: hoy(), ...body })
    .expect(201);

describe("Avisos del espacio", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("el cambio se le cuenta al otro, con su importe, y a quien lo hizo no", async () => {
    const { pastor, ws } = await iglesia();
    const tesorera = await createUser();
    await invitarYAceptar(pastor, ws, tesorera, "tesorero");

    //! El alta del equipo también avisa: se da por visto para mirar solo el gasto
    await leidos(pastor, ws);
    await gasto(pastor, ws);

    const delPastor = await avisos(pastor, ws);
    assert.equal(delPastor.unread, 0);
    assert.equal(
      delPastor.items.some((a) => a.accion === "registró un gasto"),
      false
    );

    const deLaTesorera = await avisos(tesorera, ws);
    const aviso = deLaTesorera.items.find((a) => a.accion === "registró un gasto");
    assert.ok(aviso, "la tesorera no recibió el aviso del gasto");
    assert.match(aviso.detalle, /280/);
    assert.equal(aviso.actorName, pastor.user.username);
    assert.equal(aviso.read, false);
    assert.equal(aviso.url, "/movimientos");
    assert.ok(deLaTesorera.unread >= 1);
  });

  test("marcar leídos baja el contador a cero", async () => {
    const { pastor, ws } = await iglesia();
    const tesorera = await createUser();
    await invitarYAceptar(pastor, ws, tesorera, "tesorero");
    await gasto(pastor, ws);

    const antes = await avisos(tesorera, ws);
    assert.ok(antes.unread >= 1);

    await leidos(tesorera, ws);

    const despues = await avisos(tesorera, ws);
    assert.equal(despues.unread, 0);
    assert.ok(despues.items.every((a) => a.read));
    //! El aviso no desaparece: sigue en la lista, ya leído
    assert.ok(despues.items.some((a) => a.accion === "registró un gasto"));
  });

  test("al líder de ministerio no se le cuentan los movimientos del libro", async () => {
    const { pastor, ws } = await iglesia();
    const lider = await createUser();
    await invitarYAceptar(pastor, ws, lider, "lider");

    await gasto(pastor, ws);
    await as("post", "/api/v1/funds", pastor, ws).send({ name: "Misiones" }).expect(201);

    const suyos = await avisos(lider, ws);
    //! No ve el libro: ni movimientos ni fondos
    assert.equal(suyos.items.some((a) => a.entity === "transaction"), false);
    assert.equal(suyos.items.some((a) => a.entity === "fund"), false);
    assert.equal(suyos.unread, 0);
  });

  test("el correo de quien entra al equipo solo lo ve quien gestiona miembros", async () => {
    const { pastor, ws } = await iglesia();
    const tesorera = await createUser();
    const lector = await createUser();
    await invitarYAceptar(pastor, ws, tesorera, "tesorero");
    await invitarYAceptar(pastor, ws, lector, "lector");

    const nuevo = await createUser();
    await as("post", `/api/v1/workspaces/${ws}/members`, tesorera, ws)
      .send({ email: nuevo.credentials.email, role: "contador" })
      .expect(201);

    //! El propietario gestiona miembros: ve a quién y con qué rol
    const delPastor = (await avisos(pastor, ws)).items.find((a) =>
      a.accion.startsWith("sumó a")
    );
    assert.ok(delPastor, "el propietario no vio el alta");
    assert.match(delPastor.accion, /@test\.com/);
    assert.match(delPastor.accion, /contador/);

    //! El lector no: se le cuenta el alta sin nombres ni correos
    const delLector = (await avisos(lector, ws)).items.find((a) =>
      a.accion.startsWith("sumó a")
    );
    assert.ok(delLector, "el lector no vio el alta");
    assert.doesNotMatch(delLector.accion, /@/);
    assert.match(delLector.accion, /alguien al equipo/);
  });

  test("el aviso del conteo de ofrenda dice el culto y el importe", async () => {
    const { pastor, ws } = await iglesia();
    const tesorera = await createUser();
    await invitarYAceptar(pastor, ws, tesorera, "tesorero");

    await as("post", "/api/v1/conteos", pastor, ws)
      .send({ date: hoy(), service: "Culto de domingo", amount: 300 })
      .expect(201);

    const deLaTesorera = await avisos(tesorera, ws);
    const aviso = deLaTesorera.items.find((a) => a.entity === "offeringCount");
    assert.ok(aviso, "no llegó el aviso del conteo");
    assert.match(aviso.accion, /conteo/);
    assert.match(aviso.detalle, /Culto de domingo/);
    assert.match(aviso.detalle, /300/);
    assert.equal(aviso.url, "/conteos");
  });

  test("los avisos al teléfono avisan cuando el servidor no los tiene configurados", async () => {
    const { pastor, ws } = await iglesia();

    const estado = await as("get", "/api/v1/avisos/push", pastor, ws).expect(200);
    assert.equal(estado.body.disponible, false);
    assert.equal(estado.body.publicKey, null);
    assert.deepEqual(estado.body.aparatos, []);

    const alta = await as("post", "/api/v1/avisos/push", pastor, ws)
      .send({
        subscription: { endpoint: "https://ejemplo.test/x", keys: { p256dh: "a", auth: "b" } },
      })
      .expect(503);
    assert.equal(alta.body.code, "PUSH_NOT_CONFIGURED");

    await as("post", "/api/v1/avisos/prueba", pastor, ws).expect(503);
  });

  test("un aparato se apunta una vez, aunque se active dos veces", async () => {
    const { pastor } = await iglesia();
    const subscription = {
      endpoint: "https://ejemplo.test/aparato-1",
      keys: { p256dh: "clave-publica", auth: "secreto" },
    };
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";

    await push.guardar({ user: { _id: pastor.user.id }, subscription, userAgent: ua });
    await push.guardar({ user: { _id: pastor.user.id }, subscription, userAgent: ua });

    assert.equal(await PushSubscription.countDocuments(), 1);
    const guardada = await PushSubscription.findOne().lean();
    assert.equal(guardada.p256dh, "clave-publica");
    assert.equal(guardada.userAgent, "Chrome en Android");
    assert.equal(String(guardada.user), String(pastor.user.id));

    //! Y se puede apagar
    await push.borrar({ user: { _id: pastor.user.id }, endpoint: subscription.endpoint });
    assert.equal(await PushSubscription.countDocuments(), 0);
  });

  test("nadie apaga los avisos del aparato de otro", async () => {
    const { pastor } = await iglesia();
    const otro = await createUser();
    const subscription = {
      endpoint: "https://ejemplo.test/aparato-2",
      keys: { p256dh: "p", auth: "a" },
    };
    await push.guardar({ user: { _id: pastor.user.id }, subscription, userAgent: "" });

    await push.borrar({ user: { _id: otro.user.id }, endpoint: subscription.endpoint });
    assert.equal(await PushSubscription.countDocuments(), 1);
  });

  test("una suscripción sin claves, o sin dueño, no se guarda", async () => {
    const { pastor } = await iglesia();
    assert.equal(
      await push.guardar({ user: { _id: pastor.user.id }, subscription: { endpoint: "x" }, userAgent: "" }),
      null
    );
    assert.equal(
      await push.guardar({ user: { _id: pastor.user.id }, subscription: null, userAgent: "" }),
      null
    );
    //! Sin dueño quedaría una suscripción huérfana que nadie puede apagar
    assert.equal(
      await push.guardar({
        user: {},
        subscription: { endpoint: "https://ejemplo.test/x", keys: { p256dh: "p", auth: "a" } },
        userAgent: "",
      }),
      null
    );
    assert.equal(await PushSubscription.countDocuments(), 0);
  });
});

describe("Cómo se cuenta cada cambio", () => {
  const deTesorero = { role: "tesorero", currency: "PEN" };

  test("los movimientos, con importe y categoría", () => {
    const gasto = describir({
      action: "transaction.create",
      entity: "transaction",
      after: { type: "expense", amount: 280, category: "servicios", fund: "General" },
      ...deTesorero,
    });
    assert.equal(gasto.accion, "registró un gasto");
    assert.match(gasto.detalle, /280/);
    assert.match(gasto.detalle, /servicios/);

    const ingreso = describir({
      action: "transaction.create",
      entity: "transaction",
      after: { type: "income", amount: 1260, category: "diezmos" },
      ...deTesorero,
    });
    assert.equal(ingreso.accion, "registró un ingreso");
  });

  test("la anulación dice el motivo y el pase de fondo dice de dónde a dónde", () => {
    const anulado = describir({
      action: "transaction.void",
      entity: "transaction",
      after: { amount: 50, voidReason: "estaba duplicado" },
      ...deTesorero,
    });
    assert.match(anulado.accion, /anuló/);
    assert.match(anulado.detalle, /duplicado/);

    const pase = describir({
      action: "fund.transfer",
      entity: "fundTransfer",
      after: { from: "General", to: "Misiones", amount: 100 },
      ...deTesorero,
    });
    assert.match(pase.accion, /pasó dinero/);
    assert.match(pase.detalle, /General → Misiones/);
  });

  test("el plan del ministerio solo se cuenta a quien ve los ministerios", () => {
    const entrada = {
      action: "ministry.create",
      entity: "ministry",
      after: { name: "Alabanza", year: 2026, budget: 12000 },
    };
    const tesorero = describir({ ...entrada, ...deTesorero });
    assert.match(tesorero.accion, /Alabanza/);
    assert.match(tesorero.detalle, /12/);

    //! El lector ve el libro pero no los ministerios: no se entera
    assert.equal(describir({ ...entrada, role: "lector", currency: "PEN" }), null);

    //! Y al líder de un ministerio no le llega nada: su menú es corto a propósito
    assert.equal(describir({ ...entrada, role: "lider", currency: "PEN" }), null);
  });

  test("al líder de ministerio no le llega ningún aviso, ni siquiera del equipo", () => {
    //! No tiene campana donde leerlos, así que tampoco se le mandan al teléfono
    assert.equal(
      describir({
        action: "transaction.create",
        entity: "transaction",
        after: { type: "expense", amount: 10 },
        role: "lider",
        currency: "PEN",
      }),
      null
    );
    assert.equal(
      describir({
        action: "member.add",
        entity: "member",
        after: { email: "ana@test.com", role: "contador" },
        role: "lider",
        currency: "PEN",
      }),
      null
    );
  });

  test("al líder no se le cuentan los cambios del libro, y al lector no se le nombran las personas", () => {
    assert.equal(
      describir({
        action: "transaction.create",
        entity: "transaction",
        after: { type: "expense", amount: 10 },
        role: "lider",
        currency: "PEN",
      }),
      null
    );

    const delLector = describir({
      action: "donor.create",
      entity: "donor",
      after: { name: "Ana Torres" },
      role: "lector",
      currency: "PEN",
    });
    assert.match(delLector.accion, /una persona/);
    assert.doesNotMatch(delLector.accion, /Ana/);

    const delTesorero = describir({
      action: "donor.create",
      entity: "donor",
      after: { name: "Ana Torres" },
      ...deTesorero,
    });
    assert.match(delTesorero.accion, /Ana Torres/);
  });

  test("crear el espacio no se avisa a nadie", () => {
    assert.equal(
      describir({
        action: "workspace.create",
        entity: "workspace",
        after: { name: "Iglesia Betel" },
        ...deTesorero,
      }),
      null
    );
  });
});
