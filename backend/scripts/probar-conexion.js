//! Comprueba que MONGO_URL del .env conecta y que el usuario tiene permisos.
//! No imprime la contraseña en ningún momento.
//!
//! Uso (desde la carpeta backend):
//!   node scripts/probar-conexion.js

const mongoose = require("mongoose");
const { MONGO_URL } = require("../config/env");

const describirUrl = (url) => {
  try {
    const u = new URL(url);
    return {
      usuario: decodeURIComponent(u.username),
      host: u.hostname,
      base: u.pathname.replace("/", "") || "(por defecto)",
    };
  } catch {
    return null;
  }
};

const run = async () => {
  const info = describirUrl(MONGO_URL);

  if (!info) {
    console.error(
      "MONGO_URL no tiene un formato válido. Recuerda codificar los caracteres\n" +
        "especiales de la contraseña (@ : / ? # [ ] %) con encodeURIComponent."
    );
    process.exit(1);
  }

  console.log(`Conectando como "${info.usuario}" a ${info.host} (base: ${info.base})...`);

  try {
    await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 15000 });
    console.log("✓ Conexión establecida");
  } catch (err) {
    console.error("✗ No se pudo conectar:", err.message);
    if (/authentication failed/i.test(err.message)) {
      console.error(
        "  -> Usuario o contraseña incorrectos. Si la contraseña tiene símbolos,\n" +
          "     deben ir codificados en la URL."
      );
    }
    if (/timed out|ETIMEDOUT|ENOTFOUND/i.test(err.message)) {
      console.error(
        "  -> Revisa Network Access en Atlas: tu IP (o la del hosting) debe estar\n" +
          "     en la lista de permitidas."
      );
    }
    process.exit(1);
  }

  //! Lectura y escritura reales para confirmar los permisos del usuario
  const db = mongoose.connection.db;

  try {
    const colecciones = await db.listCollections().toArray();
    console.log(
      `✓ Lectura correcta. Colecciones: ${
        colecciones.map((c) => c.name).join(", ") || "(ninguna todavía)"
      }`
    );
  } catch (err) {
    console.error("✗ Sin permisos de lectura:", err.message);
    process.exit(1);
  }

  try {
    const prueba = db.collection("_prueba_conexion");
    await prueba.insertOne({ creado: new Date() });
    //! Se elimina la colección entera para no dejar rastro en la base
    await prueba.drop();
    console.log("✓ Escritura correcta (el usuario tiene readWrite)");
  } catch (err) {
    console.error("✗ Sin permisos de escritura:", err.message);
    process.exit(1);
  }

  //! Conteo de documentos para confirmar que es la base esperada
  const [usuarios, categorias, transacciones] = await Promise.all([
    db.collection("users").countDocuments().catch(() => 0),
    db.collection("categories").countDocuments().catch(() => 0),
    db.collection("transactions").countDocuments().catch(() => 0),
  ]);

  console.log(
    `Datos actuales -> usuarios: ${usuarios}, categorías: ${categorias}, transacciones: ${transacciones}`
  );

  await mongoose.disconnect();
  console.log("Todo listo.");
};

run().catch(async (err) => {
  console.error("Error inesperado:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
