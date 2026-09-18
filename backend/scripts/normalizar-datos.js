//! Migración única para datos creados antes de la normalización.
//!
//! Qué hace:
//!   1. Pasa a minúsculas los nombres de categoría y el campo "category" de las
//!      transacciones (antes convivían "Uncategorized" y "uncategorized").
//!   2. Normaliza correos a minúsculas.
//!   3. Crea los índices nuevos (user+date, user+name único).
//!
//! Uso (desde la carpeta backend):
//!   node scripts/normalizar-datos.js            -> muestra qué cambiaría
//!   node scripts/normalizar-datos.js --aplicar  -> aplica los cambios

const mongoose = require("mongoose");
const { MONGO_URL } = require("../config/env");
const User = require("../model/User");
const Category = require("../model/Category");
const Transaction = require("../model/Transaccion");

const aplicar = process.argv.includes("--aplicar");

const run = async () => {
  await mongoose.connect(MONGO_URL);
  console.log(aplicar ? "Modo: APLICAR cambios" : "Modo: simulación (sin escribir)");

  //! 1. Categorías con mayúsculas o espacios
  const categorias = await Category.find({});
  const categoriasSucias = categorias.filter(
    (c) => c.name !== c.name.trim().toLowerCase()
  );
  console.log(`Categorías a normalizar: ${categoriasSucias.length}`);

  for (const categoria of categoriasSucias) {
    const nuevoNombre = categoria.name.trim().toLowerCase();
    console.log(`  "${categoria.name}" -> "${nuevoNombre}"`);
    if (aplicar) {
      //! Si ya existe otra categoría con ese nombre para el mismo usuario,
      //! se fusionan: las transacciones apuntan al nombre y se borra la duplicada.
      const existente = await Category.findOne({
        user: categoria.user,
        name: nuevoNombre,
        _id: { $ne: categoria._id },
      });

      await Transaction.updateMany(
        { user: categoria.user, category: categoria.name },
        { $set: { category: nuevoNombre } }
      );

      if (existente) {
        await categoria.deleteOne();
        console.log("    (duplicada, fusionada con la existente)");
      } else {
        categoria.name = nuevoNombre;
        await categoria.save();
      }
    }
  }

  //! 2. Transacciones con categoría sin normalizar
  const transacciones = await Transaction.find({});
  const transaccionesSucias = transacciones.filter(
    (t) => (t.category || "") !== (t.category || "").trim().toLowerCase()
  );
  console.log(`Transacciones a normalizar: ${transaccionesSucias.length}`);

  if (aplicar) {
    for (const transaccion of transaccionesSucias) {
      transaccion.category = (transaccion.category || "uncategorized")
        .trim()
        .toLowerCase();
      await transaccion.save();
    }
  }

  //! 3. Correos en minúsculas
  const usuarios = await User.find({});
  const usuariosSucios = usuarios.filter(
    (u) => u.email !== u.email.trim().toLowerCase()
  );
  console.log(`Correos a normalizar: ${usuariosSucios.length}`);

  if (aplicar) {
    for (const usuario of usuariosSucios) {
      usuario.email = usuario.email.trim().toLowerCase();
      await usuario.save({ validateBeforeSave: false });
    }
  }

  //! 4. Índices
  if (aplicar) {
    console.log("Sincronizando índices...");
    await Promise.all([
      User.syncIndexes(),
      Category.syncIndexes(),
      Transaction.syncIndexes(),
    ]);
  }

  console.log(
    aplicar
      ? "Migración completada."
      : "Simulación completada. Ejecuta con --aplicar para escribir los cambios."
  );

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error("Error en la migración:", err);
  await mongoose.disconnect();
  process.exit(1);
});
