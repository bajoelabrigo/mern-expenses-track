//! Migración a la fase 1 (espacios de trabajo). Se puede ejecutar varias veces:
//! lo ya migrado se salta.
//!
//! Qué hace:
//!   1. Guarda una copia JSON de usuarios, movimientos y categorías.
//!   2. A cada usuario sin espacios le crea su espacio personal y, si se
//!      registró con una iglesia, el de esa iglesia (que queda como
//!      predeterminado). Él es el propietario.
//!   3. Pasa sus movimientos y categorías a ese espacio (campo `user` ->
//!      `workspace`, y el autor queda en `createdBy`).
//!   4. Convierte `amount` (decimal) en `amountCents` (entero).
//!   5. Quita los índices viejos (por usuario) y crea los nuevos.
//!
//! Uso (desde la carpeta backend):
//!   node scripts/migrar-espacios.js            -> simulación, no escribe nada
//!   node scripts/migrar-espacios.js --aplicar  -> copia de seguridad + cambios

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

//! Se trabaja con las colecciones en crudo: los modelos ya no tienen el campo
//! `user` ni `amount`, y Mongoose los ignoraría al leer.
const col = (name) => mongoose.connection.collection(name);

const workspaceNameFor = (user) => (user.iglesia || "").trim();

const toCents = (amount) => Math.round(Number(amount) * 100);

const migrate = async ({ apply = false, backupDir = null, log = console.log } = {}) => {
  const Workspace = require("../model/Workspace");
  const Membership = require("../model/Membership");
  const summary = {
    users: 0,
    workspacesCreated: 0,
    transactionsMoved: 0,
    categoriesMoved: 0,
    amountsConverted: 0,
    orphanTransactions: 0,
    orphanCategories: 0,
    backupFile: null,
  };

  const users = await col("users").find({}).toArray();
  summary.users = users.length;

  //! 1. Copia de seguridad
  if (apply && backupDir) {
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(backupDir, `antes-de-espacios-${stamp}.json`);
    const backup = {
      users,
      transactions: await col("transactions").find({}).toArray(),
      categories: await col("categories").find({}).toArray(),
    };
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    summary.backupFile = file;
    log(`Copia de seguridad: ${file}`);
  }

  //! 2 y 3. Espacios por usuario y traslado de sus datos
  for (const user of users) {
    const hasMemberships = await col("memberships").countDocuments({ user: user._id });
    const pendingTx = await col("transactions").countDocuments({
      user: user._id,
      workspace: { $exists: false },
    });
    const pendingCats = await col("categories").countDocuments({
      user: user._id,
      workspace: { $exists: false },
    });

    if (hasMemberships && !pendingTx && !pendingCats) continue;

    const churchName = workspaceNameFor(user);
    log(
      `- ${user.username}: ${churchName ? `iglesia "${churchName}" + ` : ""}personal; ` +
        `${pendingTx} movimientos, ${pendingCats} categorías`
    );

    if (!apply) {
      summary.workspacesCreated += hasMemberships ? 0 : churchName ? 2 : 1;
      summary.transactionsMoved += pendingTx;
      summary.categoriesMoved += pendingCats;
      continue;
    }

    //! Espacios del usuario (se reutilizan si una ejecución anterior se cortó)
    const owned = await Membership.find({ user: user._id, role: "propietario" }).lean();
    const ownedWs = await Workspace.find({ _id: { $in: owned.map((m) => m.workspace) } });

    const ensure = async (kind, name) => {
      const found = ownedWs.find((w) => w.kind === kind && (kind === "personal" || w.name === name));
      if (found) return found;
      const ws = await Workspace.create({ name, kind, createdBy: user._id });
      await Membership.create({ workspace: ws._id, user: user._id, role: "propietario" });
      summary.workspacesCreated += 1;
      return ws;
    };

    const personal = await ensure("personal", "Mis finanzas");
    const target = churchName ? await ensure("iglesia", churchName) : personal;

    //! Los datos existentes son los libros que llevaba: van a la iglesia (o al
    //! personal si nunca indicó una).
    const txResult = await col("transactions").updateMany(
      { user: user._id, workspace: { $exists: false } },
      [{ $set: { workspace: target._id, createdBy: "$user" } }, { $unset: "user" }]
    );
    const catResult = await col("categories").updateMany(
      { user: user._id, workspace: { $exists: false } },
      [{ $set: { workspace: target._id } }, { $unset: "user" }]
    );
    summary.transactionsMoved += txResult.modifiedCount;
    summary.categoriesMoved += catResult.modifiedCount;

    if (!user.defaultWorkspace) {
      await col("users").updateOne({ _id: user._id }, { $set: { defaultWorkspace: target._id } });
    }
  }

  //! Datos cuyo usuario ya no existe: se informan y se dejan como están. Se
  //! cuentan por usuario inexistente (no por "sin espacio"): en la simulación
  //! nada se movió todavía y todo saldría como huérfano.
  const userIds = users.map((u) => u._id);
  const orphanFilter = { workspace: { $exists: false }, user: { $nin: userIds } };
  summary.orphanTransactions = await col("transactions").countDocuments(orphanFilter);
  summary.orphanCategories = await col("categories").countDocuments(orphanFilter);

  //! 4. amount -> amountCents. Se calcula con Math.round en JS (el $round de
  //! Mongo redondea al par y daría otro centavo en los .5).
  const toConvert = await col("transactions")
    .find({ amountCents: { $exists: false }, amount: { $exists: true } })
    .project({ amount: 1 })
    .toArray();
  summary.amountsConverted = toConvert.length;

  if (apply && toConvert.length) {
    await col("transactions").bulkWrite(
      toConvert.map((tx) => ({
        updateOne: {
          filter: { _id: tx._id },
          update: { $set: { amountCents: toCents(tx.amount) }, $unset: { amount: "" } },
        },
      }))
    );
  }

  //! 5. Índices: fuera los de por usuario, dentro los de por espacio
  if (apply) {
    for (const [collection, names] of [
      ["categories", ["user_1_name_1", "user_1"]],
      ["transactions", ["user_1_date_-1", "user_1_category_1"]],
    ]) {
      const existing = (await col(collection).indexes()).map((i) => i.name);
      for (const name of names) {
        if (existing.includes(name)) await col(collection).dropIndex(name);
      }
    }
    await Promise.all(
      ["Workspace", "Membership", "Invitation", "AuditLog", "Transaction", "Category", "User"].map(
        (name) => mongoose.model(name).syncIndexes()
      )
    );
  }

  return summary;
};

module.exports = { migrate };

//! Ejecución directa desde la línea de comandos
if (require.main === module) {
  const { MONGO_URL } = require("../config/env");
  const apply = process.argv.includes("--aplicar");

  (async () => {
    await mongoose.connect(MONGO_URL);
    console.log(apply ? "Modo: APLICAR cambios" : "Modo: simulación (sin escribir)");

    const summary = await migrate({
      apply,
      backupDir: path.join(__dirname, "..", "backups"),
    });

    console.log("\nResumen:", summary);
    if (summary.orphanTransactions || summary.orphanCategories) {
      console.log(
        "Aviso: hay datos de usuarios que ya no existen; no se tocaron (ver resumen)."
      );
    }
    if (!apply) console.log("\nNada se escribió. Para aplicar: --aplicar");
    await mongoose.disconnect();
  })().catch(async (err) => {
    console.error("Error en la migración:", err);
    await mongoose.disconnect();
    process.exit(1);
  });
}
