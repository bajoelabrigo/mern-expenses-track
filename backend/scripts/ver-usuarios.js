//! Solo lectura: lista los usuarios con su rol y cuántos datos tiene cada uno.
//! Uso (desde backend): node scripts/ver-usuarios.js
const mongoose = require("mongoose");
const { MONGO_URL } = require("../config/env");

(async () => {
  await mongoose.connect(MONGO_URL);
  const col = (name) => mongoose.connection.collection(name);
  const users = await col("users").find({}, { projection: { password: 0 } }).toArray();
  for (const u of users) {
    const tx = await col("transactions").countDocuments({ user: u._id });
    const cats = await col("categories").countDocuments({ user: u._id });
    console.log(
      `${u.username} | ${u.email} | rol: ${u.role} | iglesia: ${u.iglesia || "-"} | ` +
        `${tx} movimientos, ${cats} categorías | alta: ${u.createdAt?.toISOString?.() || "-"}`
    );
  }
  await mongoose.disconnect();
})();
