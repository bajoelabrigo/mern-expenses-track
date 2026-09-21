//! Debe ejecutarse antes de cargar la app: config/env lee process.env al importarse.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "secreto-de-pruebas-suficientemente-largo-1234567890";
process.env.CORS_ORIGINS = "http://localhost:5173";
process.env.SERVE_FRONTEND = "false";
//! Los avisos al teléfono quedan apagados en las pruebas, aunque quien las corra
//! tenga las claves en su .env: así ninguna prueba intenta hablar con el
//! servicio de push, y el resultado no depende del .env de cada uno.
process.env.VAPID_PUBLIC_KEY = "";
process.env.VAPID_PRIVATE_KEY = "";

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const app = require("../app");

let mongoServer;

//! Levanta un MongoDB en memoria y conecta mongoose
const setupDatabase = async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  //! Asegura que los índices únicos existan antes de las pruebas
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.syncIndexes())
  );
};

const teardownDatabase = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
};

const clearDatabase = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
};

//! Registra un usuario y devuelve su token + datos
const createUser = async (overrides = {}) => {
  const payload = {
    username: overrides.username || `usuario${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    email: overrides.email || `user${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.com`,
    password: overrides.password || "Password123",
    iglesia: overrides.iglesia || "Iglesia Central",
  };

  await request(app).post("/api/v1/users/register").send(payload).expect(201);

  const login = await request(app)
    .post("/api/v1/users/login")
    .send({ email: payload.email, password: payload.password })
    .expect(200);

  return {
    token: login.body.token,
    user: login.body.user,
    credentials: payload,
  };
};

//! Convierte a un usuario ya creado en administrador
const promoteToAdmin = async (userId) => {
  const User = require("../model/User");
  await User.findByIdAndUpdate(userId, { role: "admin" });
};

const auth = (req, token) => req.set("Authorization", `Bearer ${token}`);

//! La fecha de HOY en hora LOCAL, que es la que usa la app: los totales
//! cuentan "hasta el final de hoy" en la zona del servidor. Tomarla en UTC
//! (toISOString) adelanta un día al caer la tarde en América y el movimiento
//! se queda fuera del corte.
const hoy = () => {
  const d = new Date();
  const dd = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
};

module.exports = {
  app,
  hoy,
  request,
  mongoose,
  setupDatabase,
  teardownDatabase,
  clearDatabase,
  createUser,
  promoteToAdmin,
  auth,
};
