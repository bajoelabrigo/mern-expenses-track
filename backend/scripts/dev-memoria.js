//! Arranca la API contra un MongoDB EN MEMORIA, para probar la app en local sin
//! tocar la base real (el .env apunta a Atlas). Los datos se pierden al parar.
//!
//! Uso (desde la carpeta backend):
//!   node scripts/dev-memoria.js
//! y en otra terminal, el frontend con VITE_API_URL=http://localhost:8000/api/v1

const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongo.getUri("expenses-tracker");
  process.env.NODE_ENV = "development";
  process.env.JWT_SECRET =
    process.env.JWT_SECRET_DEV || "secreto-local-de-desarrollo-suficientemente-largo-123";
  //! Sin SMTP: los enlaces de los correos salen en esta consola
  process.env.SMTP_HOST = "";
  console.log(`MongoDB en memoria: ${process.env.MONGO_URL}`);
  require("../server");
})();
