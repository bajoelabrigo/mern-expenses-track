const mongoose = require("mongoose");
const app = require("./app");
const { MONGO_URL, PORT, NODE_ENV } = require("./config/env");

//! Errores no capturados: se registran y el proceso termina de forma controlada
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  process.exit(1);
});

const start = async () => {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("DB conectada");
  } catch (err) {
    console.error("Error conectando a MongoDB:", err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT} (${NODE_ENV})`);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
    server.close(() => process.exit(1));
  });

  //! Apagado ordenado: deja de aceptar conexiones y cierra Mongo
  const shutdown = (signal) => async () => {
    console.log(`${signal} recibido, cerrando servidor...`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown("SIGTERM"));
  process.on("SIGINT", shutdown("SIGINT"));
};

start();
