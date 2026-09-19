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
const Invitation = require("../model/Invitation");

const as = (method, url, user, workspaceId) => {
  const req = request(app)[method](url).set("Authorization", `Bearer ${user.token}`);
  return workspaceId ? req.set("X-Workspace-Id", String(workspaceId)) : req;
};

//! Invita a `invitado` al espacio con `role` y lo acepta. Devuelve la respuesta
//! de la invitación.
const invitarYAceptar = async (anfitrion, workspaceId, invitado, role) => {
  const inv = await as("post", `/api/v1/workspaces/${workspaceId}/invitations`, anfitrion)
    .send({ email: invitado.credentials.email, role })
    .expect(201);
  const token = inv.body.url.split("/invitacion/")[1];
  await as("post", `/api/v1/invitations/${token}/accept`, invitado).expect(200);
  return inv;
};

const crearMovimiento = (user, workspaceId, body) =>
  as("post", "/api/v1/transactions/create", user, workspaceId).send({
    type: "income",
    date: "2025-06-10T12:00:00.000Z",
    ...body,
  });

describe("Espacios, roles e invitaciones", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(() => {
    sentInTests.length = 0;
    return clearDatabase();
  });

  test("el registro crea el espacio personal y el de la iglesia (predeterminado)", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });

    const res = await as("get", "/api/v1/workspaces", pastor).expect(200);

    assert.equal(res.body.length, 2);
    //! El predeterminado va primero
    assert.equal(res.body[0].name, "Iglesia Betel");
    assert.equal(res.body[0].kind, "iglesia");
    assert.equal(res.body[0].isDefault, true);
    assert.equal(res.body[0].role, "propietario");
    assert.ok(res.body[0].permissions.includes("members:manage"));
    assert.equal(res.body[1].kind, "personal");
    assert.equal(String(pastor.user.defaultWorkspace), String(res.body[0]._id));
  });

  test("sin iglesia se registra solo con el espacio personal", async () => {
    const res = await request(app)
      .post("/api/v1/users/register")
      .send({ username: "solo_personal", email: "p@test.com", password: "Password123" })
      .expect(201);

    const login = await request(app)
      .post("/api/v1/users/login")
      .send({ email: "p@test.com", password: "Password123" })
      .expect(200);

    const espacios = await as("get", "/api/v1/workspaces", { token: login.body.token });
    assert.equal(espacios.body.length, 1);
    assert.equal(espacios.body[0].kind, "personal");
    assert.equal(String(res.body.user.defaultWorkspace), String(espacios.body[0]._id));
  });

  test("los movimientos de un espacio no se mezclan con los de otro del mismo usuario", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const [iglesia, personal] = (await as("get", "/api/v1/workspaces", pastor)).body;

    await crearMovimiento(pastor, iglesia._id, { amount: 500 }).expect(201);
    await crearMovimiento(pastor, personal._id, { amount: 20 }).expect(201);

    const balIglesia = await as("get", "/api/v1/transactions/balance", pastor, iglesia._id);
    const balPersonal = await as("get", "/api/v1/transactions/balance", pastor, personal._id);
    //! Sin cabecera se usa el predeterminado (la iglesia)
    const balDefecto = await as("get", "/api/v1/transactions/balance", pastor);

    assert.equal(balIglesia.body.income, 500);
    assert.equal(balPersonal.body.income, 20);
    assert.equal(balDefecto.body.income, 500);
  });

  test("los miembros comparten los libros y las categorías del espacio", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const tesorera = await createUser();
    const espacio = pastor.user.defaultWorkspace;

    await invitarYAceptar(pastor, espacio, tesorera, "tesorero");

    await as("post", "/api/v1/categories/create", pastor, espacio)
      .send({ name: "diezmos", type: "income" })
      .expect(201);
    await crearMovimiento(tesorera, espacio, { amount: 300, category: "diezmos" }).expect(201);

    const cats = await as("get", "/api/v1/categories/lists", tesorera, espacio).expect(200);
    const lista = await as("get", "/api/v1/transactions/lists", pastor, espacio).expect(200);

    assert.deepEqual(cats.body.map((c) => c.name), ["diezmos"]);
    assert.equal(lista.body.total, 1);
    assert.equal(lista.body.transactions[0].createdBy.username, tesorera.user.username);
  });

  test("cada rol solo puede lo suyo", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const contador = await createUser();
    const auditor = await createUser();
    const lector = await createUser();
    const espacio = pastor.user.defaultWorkspace;

    await invitarYAceptar(pastor, espacio, contador, "contador");
    await invitarYAceptar(pastor, espacio, auditor, "auditor");
    await invitarYAceptar(pastor, espacio, lector, "lector");

    //! Contador: escribe, pero no gestiona miembros ni ve el historial
    await crearMovimiento(contador, espacio, { amount: 10 }).expect(201);
    await as("post", `/api/v1/workspaces/${espacio}/invitations`, contador)
      .send({ email: "x@test.com", role: "lector" })
      .expect(403);
    await as("get", `/api/v1/workspaces/${espacio}/audit`, contador).expect(403);

    //! Auditor: lee todo y el historial, no escribe
    await as("get", "/api/v1/transactions/lists", auditor, espacio).expect(200);
    await as("get", `/api/v1/workspaces/${espacio}/audit`, auditor).expect(200);
    await crearMovimiento(auditor, espacio, { amount: 10 }).expect(403);
    await as("post", "/api/v1/categories/create", auditor, espacio)
      .send({ name: "x", type: "income" })
      .expect(403);

    //! Lector: solo lee
    await as("get", "/api/v1/transactions/balance", lector, espacio).expect(200);
    await crearMovimiento(lector, espacio, { amount: 10 }).expect(403);
    await as("get", `/api/v1/workspaces/${espacio}/audit`, lector).expect(403);

    //! Los correos de los miembros solo los ve quien gestiona miembros
    const vistaLector = await as("get", `/api/v1/workspaces/${espacio}/members`, lector);
    const vistaPastor = await as("get", `/api/v1/workspaces/${espacio}/members`, pastor);
    assert.equal(vistaLector.body.length, 4);
    vistaLector.body.forEach((m) => assert.equal(m.email, undefined));
    vistaPastor.body.forEach((m) => assert.ok(m.email));
  });

  test("un tesorero no puede nombrar propietarios ni tocar a otro tesorero", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const tesorero = await createUser();
    const otroTesorero = await createUser();
    const contador = await createUser();
    const espacio = pastor.user.defaultWorkspace;

    await invitarYAceptar(pastor, espacio, tesorero, "tesorero");
    await invitarYAceptar(pastor, espacio, otroTesorero, "tesorero");
    await invitarYAceptar(tesorero, espacio, contador, "contador");

    await as("post", `/api/v1/workspaces/${espacio}/invitations`, tesorero)
      .send({ email: "nuevo@test.com", role: "propietario" })
      .expect(403);
    await as("put", `/api/v1/workspaces/${espacio}/members/${contador.user.id}`, tesorero)
      .send({ role: "propietario" })
      .expect(403);
    await as("put", `/api/v1/workspaces/${espacio}/members/${tesorero.user.id}`, tesorero)
      .send({ role: "propietario" })
      .expect(403);
    await as("delete", `/api/v1/workspaces/${espacio}/members/${otroTesorero.user.id}`, tesorero)
      .expect(403);

    //! Sí puede cambiar y quitar a un contador
    await as("put", `/api/v1/workspaces/${espacio}/members/${contador.user.id}`, tesorero)
      .send({ role: "lector" })
      .expect(200);
    await as("delete", `/api/v1/workspaces/${espacio}/members/${contador.user.id}`, tesorero)
      .expect(200);
    await as("get", "/api/v1/transactions/lists", contador, espacio).expect(403);
  });

  test("el último propietario no puede irse ni degradarse", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const copastor = await createUser();
    const espacio = pastor.user.defaultWorkspace;

    await as("delete", `/api/v1/workspaces/${espacio}/members/${pastor.user.id}`, pastor)
      .expect(409);
    await as("put", `/api/v1/workspaces/${espacio}/members/${pastor.user.id}`, pastor)
      .send({ role: "tesorero" })
      .expect(409);

    //! Con un segundo propietario, sí
    await invitarYAceptar(pastor, espacio, copastor, "propietario");
    await as("delete", `/api/v1/workspaces/${espacio}/members/${pastor.user.id}`, pastor)
      .expect(200);

    //! Y su predeterminado pasa a otro de sus espacios
    const espacios = await as("get", "/api/v1/workspaces", pastor).expect(200);
    assert.equal(espacios.body.length, 1);
    assert.equal(espacios.body[0].kind, "personal");
    assert.equal(espacios.body[0].isDefault, true);
  });

  test("la invitación es solo para el correo invitado", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const invitada = await createUser();
    const colado = await createUser();
    const espacio = pastor.user.defaultWorkspace;

    const inv = await as("post", `/api/v1/workspaces/${espacio}/invitations`, pastor)
      .send({ email: invitada.credentials.email.toUpperCase(), role: "contador" })
      .expect(201);
    const token = inv.body.url.split("/invitacion/")[1];

    assert.equal(inv.body.emailSent, true);
    assert.equal(sentInTests.length, 1);
    assert.equal(sentInTests[0].to, invitada.credentials.email);
    assert.ok(sentInTests[0].text.includes(inv.body.url));

    //! Vista previa sin sesión
    const preview = await request(app).get(`/api/v1/invitations/${token}`).expect(200);
    assert.equal(preview.body.workspaceName, "Iglesia Betel");
    assert.equal(preview.body.role, "contador");

    const res = await as("post", `/api/v1/invitations/${token}/accept`, colado).expect(403);
    assert.equal(res.body.code, "EMAIL_MISMATCH");

    await as("post", `/api/v1/invitations/${token}/accept`, invitada).expect(200);
    //! Un enlace aceptado no se reutiliza
    await as("post", `/api/v1/invitations/${token}/accept`, invitada).expect(409);
  });

  test("invitaciones revocadas, sustituidas o caducadas no sirven", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const invitada = await createUser();
    const espacio = pastor.user.defaultWorkspace;
    const email = invitada.credentials.email;

    const primera = await as("post", `/api/v1/workspaces/${espacio}/invitations`, pastor)
      .send({ email, role: "lector" })
      .expect(201);
    const segunda = await as("post", `/api/v1/workspaces/${espacio}/invitations`, pastor)
      .send({ email, role: "contador" })
      .expect(201);

    const tokenPrimera = primera.body.url.split("/invitacion/")[1];
    await request(app).get(`/api/v1/invitations/${tokenPrimera}`).expect(410);

    //! Solo queda una pendiente
    const pendientes = await as("get", `/api/v1/workspaces/${espacio}/invitations`, pastor);
    assert.equal(pendientes.body.length, 1);
    assert.equal(pendientes.body[0].role, "contador");

    await as("delete", `/api/v1/workspaces/${espacio}/invitations/${segunda.body._id}`, pastor)
      .expect(200);
    const tokenSegunda = segunda.body.url.split("/invitacion/")[1];
    await as("post", `/api/v1/invitations/${tokenSegunda}/accept`, invitada).expect(410);

    //! Caducada
    const tercera = await as("post", `/api/v1/workspaces/${espacio}/invitations`, pastor)
      .send({ email, role: "lector" })
      .expect(201);
    await Invitation.updateOne({ _id: tercera.body._id }, { expiresAt: new Date(Date.now() - 1000) });
    const tokenTercera = tercera.body.url.split("/invitacion/")[1];
    await as("post", `/api/v1/invitations/${tokenTercera}/accept`, invitada).expect(410);

    await request(app).get("/api/v1/invitations/token-inventado").expect(404);
  });

  test("no se invita a quien ya es miembro", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const miembro = await createUser();
    const espacio = pastor.user.defaultWorkspace;

    await invitarYAceptar(pastor, espacio, miembro, "lector");
    await as("post", `/api/v1/workspaces/${espacio}/invitations`, pastor)
      .send({ email: miembro.credentials.email, role: "contador" })
      .expect(409);
  });

  test("ajustes del espacio: nombre y moneda, solo el propietario", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const tesorero = await createUser();
    const espacio = pastor.user.defaultWorkspace;
    await invitarYAceptar(pastor, espacio, tesorero, "tesorero");

    await as("put", `/api/v1/workspaces/${espacio}`, tesorero)
      .send({ name: "Otra" })
      .expect(403);
    await as("put", `/api/v1/workspaces/${espacio}`, pastor)
      .send({ currency: "XYZ" })
      .expect(400);

    const res = await as("put", `/api/v1/workspaces/${espacio}`, pastor)
      .send({ name: "Iglesia Betel Central", currency: "PEN" })
      .expect(200);
    assert.equal(res.body.name, "Iglesia Betel Central");
    assert.equal(res.body.currency, "PEN");
  });

  test("elegir el espacio predeterminado exige ser miembro", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const otro = await createUser();
    const [, personal] = (await as("get", "/api/v1/workspaces", pastor)).body;

    await as("put", "/api/v1/users/default-workspace", pastor)
      .send({ workspaceId: otro.user.defaultWorkspace })
      .expect(403);

    await as("put", "/api/v1/users/default-workspace", pastor)
      .send({ workspaceId: personal._id })
      .expect(200);

    const bal = await crearMovimiento(pastor, null, { amount: 7 }).expect(201);
    assert.equal(String(bal.body[0].workspace), String(personal._id));
  });

  test("borrar un espacio exige su nombre exacto y se lleva todo", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const miembro = await createUser();
    const espacio = pastor.user.defaultWorkspace;
    await invitarYAceptar(pastor, espacio, miembro, "lector");
    await crearMovimiento(pastor, espacio, { amount: 5 }).expect(201);

    await as("delete", `/api/v1/workspaces/${espacio}`, miembro)
      .send({ confirmName: "Iglesia Betel" })
      .expect(403);
    await as("delete", `/api/v1/workspaces/${espacio}`, pastor)
      .send({ confirmName: "iglesia betel" })
      .expect(400);
    await as("delete", `/api/v1/workspaces/${espacio}`, pastor)
      .send({ confirmName: "Iglesia Betel" })
      .expect(200);

    await as("get", "/api/v1/transactions/lists", pastor, espacio).expect(404);
    //! El miembro sigue funcionando con sus propios espacios
    const suyos = await as("get", "/api/v1/workspaces", miembro).expect(200);
    assert.ok(suyos.body.length > 0);
    assert.ok(suyos.body.every((w) => w.name !== "Iglesia Betel"));
    assert.equal(suyos.body.filter((w) => w.isDefault).length, 1);
  });
});

describe("Anulación, centavos e historial", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("los montos se suman en centavos sin error de coma flotante", async () => {
    const user = await createUser();

    await crearMovimiento(user, null, { amount: 0.1 }).expect(201);
    await crearMovimiento(user, null, { amount: 0.2 }).expect(201);
    await crearMovimiento(user, null, { amount: 19.99, type: "expense" }).expect(201);

    const bal = await as("get", "/api/v1/transactions/balance", user).expect(200);
    assert.equal(bal.body.income, 0.3);
    assert.equal(bal.body.expense, 19.99);
    assert.equal(bal.body.balance, -19.69);

    //! Un monto con más de dos decimales se redondea al centavo
    const res = await crearMovimiento(user, null, { amount: 10.005 }).expect(201);
    assert.equal(res.body[0].amount, 10.01);
    assert.equal(res.body[0].amountCents, undefined);
  });

  test("anular deja la fila visible, sin sumar, y se puede restaurar", async () => {
    const user = await createUser();
    const creada = await crearMovimiento(user, null, { amount: 100 }).expect(201);
    const id = creada.body[0]._id;

    await as("post", `/api/v1/transactions/${id}/void`, user)
      .send({ reason: "Duplicado" })
      .expect(200);
    await as("post", `/api/v1/transactions/${id}/void`, user).expect(409);

    const bal = await as("get", "/api/v1/transactions/balance", user);
    assert.equal(bal.body.income, 0);

    //! Por defecto el listado no la muestra; con includeVoided sí
    const normal = await as("get", "/api/v1/transactions/lists", user);
    assert.equal(normal.body.total, 0);
    const conAnulados = await as("get", "/api/v1/transactions/lists?includeVoided=true", user);
    assert.equal(conAnulados.body.total, 1);
    assert.equal(conAnulados.body.transactions[0].voided, true);
    assert.equal(conAnulados.body.transactions[0].voidReason, "Duplicado");
    assert.equal(conAnulados.body.transactions[0].voidedBy.username, user.user.username);

    //! Ni con includeVoided suman en el balance
    const balCon = await as("get", "/api/v1/transactions/balance?includeVoided=true", user);
    assert.equal(balCon.body.income, 0);

    //! Anulada no se edita
    await as("put", `/api/v1/transactions/update/${id}`, user).send({ amount: 5 }).expect(409);

    await as("post", `/api/v1/transactions/${id}/restore`, user).expect(200);
    const balDespues = await as("get", "/api/v1/transactions/balance", user);
    assert.equal(balDespues.body.income, 100);
  });

  test("la ruta vieja DELETE /delete/:id ahora anula", async () => {
    const user = await createUser();
    const creada = await crearMovimiento(user, null, { amount: 100 }).expect(201);
    const id = creada.body[0]._id;

    await as("delete", `/api/v1/transactions/delete/${id}`, user).expect(200);

    const una = await as("get", `/api/v1/transactions/${id}`, user).expect(200);
    assert.equal(una.body.voided, true);
  });

  test("borrar definitivamente es solo del propietario", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const tesorero = await createUser();
    const espacio = pastor.user.defaultWorkspace;
    await invitarYAceptar(pastor, espacio, tesorero, "tesorero");

    const creada = await crearMovimiento(pastor, espacio, { amount: 1 }).expect(201);
    const id = creada.body[0]._id;

    await as("delete", `/api/v1/transactions/${id}/purge`, tesorero, espacio).expect(403);
    await as("delete", `/api/v1/transactions/${id}/purge`, pastor, espacio).expect(200);
    await as("get", `/api/v1/transactions/${id}`, pastor, espacio).expect(404);
  });

  test("el historial registra quién hizo qué, con antes y después", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const espacio = pastor.user.defaultWorkspace;

    const creada = await crearMovimiento(pastor, espacio, { amount: 100 }).expect(201);
    const id = creada.body[0]._id;
    await as("put", `/api/v1/transactions/update/${id}`, pastor, espacio)
      .send({ amount: 120 })
      .expect(200);
    await as("post", `/api/v1/transactions/${id}/void`, pastor, espacio)
      .send({ reason: "Error de captura" })
      .expect(200);

    const res = await as("get", `/api/v1/workspaces/${espacio}/audit?entityId=${id}`, pastor)
      .expect(200);

    const acciones = res.body.entries.map((e) => e.action);
    assert.deepEqual(acciones, ["transaction.void", "transaction.update", "transaction.create"]);

    const edicion = res.body.entries[1];
    assert.equal(edicion.actorName, pastor.user.username);
    assert.equal(edicion.before.amount, 100);
    assert.equal(edicion.after.amount, 120);
    assert.equal(res.body.entries[0].note, "Error de captura");
  });
});

describe("Movimientos registrados sin conexión (clientId)", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("reenviar el mismo movimiento no lo duplica", async () => {
    const user = await createUser();
    const body = { amount: 50, clientId: "offline-abc12345" };

    const primero = await crearMovimiento(user, null, body).expect(201);
    const reenvio = await crearMovimiento(user, null, body).expect(200);

    assert.equal(reenvio.body[0]._id, primero.body[0]._id);
    const lista = await as("get", "/api/v1/transactions/lists", user);
    assert.equal(lista.body.total, 1);
  });

  test("dos reenvíos a la vez tampoco lo duplican", async () => {
    const user = await createUser();
    const body = { amount: 50, clientId: "offline-simultaneo1" };

    const [a, b] = await Promise.all([
      crearMovimiento(user, null, body),
      crearMovimiento(user, null, body),
    ]);

    assert.deepEqual([a.status, b.status].sort(), [200, 201]);
    const lista = await as("get", "/api/v1/transactions/lists", user);
    assert.equal(lista.body.total, 1);
  });

  test("el mismo clientId en otro espacio es otro movimiento", async () => {
    const pastor = await createUser({ iglesia: "Iglesia Betel" });
    const [iglesia, personal] = (await as("get", "/api/v1/workspaces", pastor)).body;
    const body = { amount: 10, clientId: "offline-mismo-id" };

    await crearMovimiento(pastor, iglesia._id, body).expect(201);
    await crearMovimiento(pastor, personal._id, body).expect(201);
  });

  test("un clientId con caracteres raros se rechaza", async () => {
    const user = await createUser();
    await crearMovimiento(user, null, { amount: 5, clientId: "<script>" }).expect(400);
    await crearMovimiento(user, null, { amount: 5, clientId: { $ne: 1 } }).expect(400);
  });
});

describe("Recuperación de contraseña", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(() => {
    sentInTests.length = 0;
    return clearDatabase();
  });

  const pedirEnlace = (email) =>
    request(app).post("/api/v1/users/forgot-password").send({ email }).expect(200);

  test("envía un enlace que cambia la contraseña y cierra las sesiones viejas", async () => {
    const user = await createUser();

    const res = await pedirEnlace(user.credentials.email);
    assert.match(res.body.message, /si el correo está registrado/i);
    assert.equal(sentInTests.length, 1);

    const token = sentInTests[0].text.match(/restablecer-contrasena\/([a-f0-9]+)/)[1];

    await request(app)
      .post(`/api/v1/users/reset-password/${token}`)
      .send({ password: "corta" })
      .expect(400);
    await request(app)
      .post(`/api/v1/users/reset-password/${token}`)
      .send({ password: "NuevaClave123" })
      .expect(200);

    //! El token viejo de sesión ya no sirve
    const vieja = await as("get", "/api/v1/users/profile", user).expect(401);
    assert.equal(vieja.body.code, "PASSWORD_CHANGED");

    //! El enlace es de un solo uso
    await request(app)
      .post(`/api/v1/users/reset-password/${token}`)
      .send({ password: "OtraClave123" })
      .expect(400);

    await request(app)
      .post("/api/v1/users/login")
      .send({ email: user.credentials.email, password: user.credentials.password })
      .expect(401);
    const login = await request(app)
      .post("/api/v1/users/login")
      .send({ email: user.credentials.email, password: "NuevaClave123" })
      .expect(200);
    //! La sesión nueva funciona (no la invalida el cambio de contraseña)
    await as("get", "/api/v1/users/profile", { token: login.body.token }).expect(200);
  });

  test("responde igual con un correo que no existe y no envía nada", async () => {
    const res = await pedirEnlace("nadie@test.com");
    assert.match(res.body.message, /si el correo está registrado/i);
    assert.equal(sentInTests.length, 0);
  });

  test("un enlace caducado no sirve", async () => {
    const user = await createUser();
    await pedirEnlace(user.credentials.email);
    const token = sentInTests[0].text.match(/restablecer-contrasena\/([a-f0-9]+)/)[1];

    const User = require("../model/User");
    await User.updateOne(
      { email: user.credentials.email },
      { passwordResetExpires: new Date(Date.now() - 1000) }
    );

    const res = await request(app)
      .post(`/api/v1/users/reset-password/${token}`)
      .send({ password: "NuevaClave123" })
      .expect(400);
    assert.equal(res.body.code, "INVALID_RESET_TOKEN");
  });
});
