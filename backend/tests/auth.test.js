const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const {
  app,
  request,
  setupDatabase,
  teardownDatabase,
  clearDatabase,
  createUser,
  mongoose,
} = require("./helpers");
const { JWT_SECRET } = require("../config/env");

describe("Autenticación", () => {
  before(setupDatabase);
  after(teardownDatabase);
  beforeEach(clearDatabase);

  test("registra un usuario y no devuelve nunca el hash de la contraseña", async () => {
    const res = await request(app)
      .post("/api/v1/users/register")
      .send({
        username: "pastor",
        email: "Pastor@Iglesia.com",
        password: "Password123",
        iglesia: "Central",
      })
      .expect(201);

    assert.equal(res.body.user.email, "pastor@iglesia.com"); // normalizado
    assert.equal(res.body.user.role, "user");
    assert.equal(res.body.user.password, undefined);
  });

  test("rechaza contraseñas de menos de 8 caracteres", async () => {
    const res = await request(app)
      .post("/api/v1/users/register")
      .send({
        username: "corto",
        email: "corto@test.com",
        password: "1234567",
        iglesia: "Central",
      })
      .expect(400);

    assert.match(res.body.message, /al menos 8/);
  });

  test("no permite registrar dos veces el mismo correo", async () => {
    const payload = {
      username: "repetido",
      email: "repe@test.com",
      password: "Password123",
      iglesia: "Central",
    };
    await request(app).post("/api/v1/users/register").send(payload).expect(201);

    const res = await request(app)
      .post("/api/v1/users/register")
      .send({ ...payload, username: "otro" })
      .expect(409);

    assert.match(res.body.message, /correo/i);
  });

  test("el login devuelve token en el body y cookie httpOnly", async () => {
    const { credentials } = await createUser();

    const res = await request(app)
      .post("/api/v1/users/login")
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);

    assert.ok(res.body.token, "el token debe viajar en el body");
    const cookie = res.headers["set-cookie"].join(";");
    assert.match(cookie, /token=/);
    assert.match(cookie, /HttpOnly/i);
  });

  test("el login con credenciales incorrectas responde 401 sin filtrar detalles", async () => {
    const { credentials } = await createUser();

    const res = await request(app)
      .post("/api/v1/users/login")
      .send({ email: credentials.email, password: "OtraClave123" })
      .expect(401);

    assert.equal(res.body.message, "Credenciales inválidas");
  });

  test("el perfil exige token y responde con los datos del usuario", async () => {
    const { token, user } = await createUser();

    await request(app).get("/api/v1/users/profile").expect(401);

    const res = await request(app)
      .get("/api/v1/users/profile")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(res.body.email, user.email);
    assert.equal(res.body.password, undefined);
  });

  test("cambiar contraseña exige la contraseña actual", async () => {
    const { token } = await createUser();

    const res = await request(app)
      .put("/api/v1/users/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "NuevaClave123" })
      .expect(400);

    assert.match(res.body.message, /contraseña actual/i);
  });

  test("cambiar contraseña con la actual incorrecta responde 401", async () => {
    const { token } = await createUser();

    await request(app)
      .put("/api/v1/users/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "NoEsLaMia123", newPassword: "NuevaClave123" })
      .expect(401);
  });

  test("tras cambiar la contraseña los tokens anteriores dejan de servir", async () => {
    const { token, credentials } = await createUser();

    await request(app)
      .put("/api/v1/users/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: credentials.password,
        newPassword: "NuevaClave123",
      })
      .expect(200);

    const res = await request(app)
      .get("/api/v1/users/profile")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);

    assert.equal(res.body.code, "PASSWORD_CHANGED");

    //! Y la contraseña nueva sí permite iniciar sesión
    await request(app)
      .post("/api/v1/users/login")
      .send({ email: credentials.email, password: "NuevaClave123" })
      .expect(200);
  });

  test("un token manipulado es rechazado", async () => {
    const res = await request(app)
      .get("/api/v1/users/profile")
      .set("Authorization", "Bearer token.falso.invalido")
      .expect(401);

    assert.equal(res.body.code, "INVALID_TOKEN");
  });

  //! ── La cookie y el encabezado, que pueden no estar de acuerdo ──
  //! Pasó de verdad al migrar los datos: la cookie quedó apuntando a un usuario
  //! que ya no existía y la app mandaba un token nuevo y bueno en el encabezado.
  //! El servidor la echaba al login igual, sin manera de entrar hasta que
  //! caducara la cookie.

  test("la cookie buena, sola, sigue sirviendo", async () => {
    const { token, credentials } = await createUser();

    const res = await request(app)
      .get("/api/v1/users/profile")
      .set("Cookie", `token=${token}`)
      .expect(200);

    assert.equal(res.body.email, credentials.email);
  });

  test("una cookie vieja no tumba un token bueno del encabezado", async () => {
    const { token, credentials } = await createUser();

    const res = await request(app)
      .get("/api/v1/users/profile")
      .set("Cookie", "token=cookie.vieja.invalida")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.equal(res.body.email, credentials.email);
  });

  test("una cookie de una cuenta borrada no tumba un token bueno", async () => {
    const { token } = await createUser();

    //! El token de la cookie está bien firmado, pero su usuario ya no existe:
    //! es el caso exacto de la migración.
    const fantasma = jwt.sign(
      { id: String(new mongoose.Types.ObjectId()), role: "user", v: 0 },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    await request(app)
      .get("/api/v1/users/profile")
      .set("Cookie", `token=${fantasma}`)
      .expect(401);

    const res = await request(app)
      .get("/api/v1/users/profile")
      .set("Cookie", `token=${fantasma}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    assert.ok(res.body.email);
  });

  test("si no sirve ninguno de los dos, 401 con el motivo", async () => {
    const res = await request(app)
      .get("/api/v1/users/profile")
      .set("Cookie", "token=cookie.mala")
      .set("Authorization", "Bearer token.falso.invalido")
      .expect(401);

    assert.equal(res.body.code, "INVALID_TOKEN");
  });

  test("un token con una contraseña cambiada no cuela por el encabezado", async () => {
    const { token, credentials } = await createUser();

    await request(app)
      .put("/api/v1/users/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: credentials.password, newPassword: "NuevaClave123" })
      .expect(200);

    //! Da igual en qué sitio venga el token viejo: no sirve
    const res = await request(app)
      .get("/api/v1/users/profile")
      .set("Cookie", `token=${token}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(401);

    assert.equal(res.body.code, "PASSWORD_CHANGED");
  });

  test("un token con un id que no es un id se rechaza, no rompe el servidor", async () => {
    const falso = jwt.sign({ id: "no-soy-un-id", role: "user", v: 0 }, JWT_SECRET, {
      expiresIn: "1h",
    });

    const res = await request(app)
      .get("/api/v1/users/profile")
      .set("Authorization", `Bearer ${falso}`)
      .expect(401);

    assert.equal(res.body.code, "INVALID_TOKEN");
  });

  test("actualizar perfil impide duplicar el correo de otro usuario", async () => {
    const primero = await createUser({ email: "uno@test.com" });
    const segundo = await createUser({ email: "dos@test.com" });

    const res = await request(app)
      .put("/api/v1/users/update-profile")
      .set("Authorization", `Bearer ${segundo.token}`)
      .send({ email: primero.credentials.email })
      .expect(409);

    assert.match(res.body.message, /en uso/i);
  });

  test("las respuestas de error no incluyen stack trace en producción", async () => {
    //! En test/desarrollo sí se incluye para depurar; el flag vive en config/env
    const { isProduction } = require("../config/env");
    assert.equal(isProduction, false);

    const res = await request(app).get("/api/v1/ruta/que/no/existe").expect(404);
    assert.match(res.body.message, /no encontrada/i);
  });
});

describe("CORS", () => {
  before(setupDatabase);
  after(teardownDatabase);

  test("un origen permitido recibe las cabeceras CORS", async () => {
    const res = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:5173")
      .expect(200);

    assert.equal(
      res.headers["access-control-allow-origin"],
      "http://localhost:5173"
    );
  });

  test("un origen no permitido no recibe cabeceras CORS ni provoca un 500", async () => {
    const res = await request(app)
      .get("/health")
      .set("Origin", "https://sitio-malicioso.com")
      .expect(200);

    assert.equal(res.headers["access-control-allow-origin"], undefined);
  });
});
