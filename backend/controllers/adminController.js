const asyncHandler = require("express-async-handler");
const User = require("../model/User");
const Workspace = require("../model/Workspace");
const Membership = require("../model/Membership");
const Transaction = require("../model/Transaccion");

//! Administración de la PLATAFORMA (rol "admin" del usuario), no de un espacio.
//! Para ver o corregir los libros de un espacio, el admin entra a él como
//! soporte (ver middlewares/workspace.js): se usan las mismas rutas y reglas
//! que un propietario, y todo queda en el historial con su nombre.

//! a) Usuarios con sus espacios y rol en cada uno
exports.getAllUsers = asyncHandler(async (req, res) => {
  const [users, memberships] = await Promise.all([
    User.find().sort({ createdAt: -1 }).lean(),
    Membership.find().populate("workspace", "name kind").lean(),
  ]);

  const byUser = new Map();
  memberships.forEach((m) => {
    if (!m.workspace) return;
    const list = byUser.get(String(m.user)) || [];
    list.push({
      _id: m.workspace._id,
      name: m.workspace.name,
      kind: m.workspace.kind,
      role: m.role,
    });
    byUser.set(String(m.user), list);
  });

  res.json(
    users.map((u) => ({
      _id: u._id,
      username: u.username,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      workspaces: byUser.get(String(u._id)) || [],
    }))
  );
});

//! b) Espacios con miembros y cantidad de movimientos
exports.getAllWorkspaces = asyncHandler(async (req, res) => {
  const [workspaces, memberCounts, txCounts] = await Promise.all([
    Workspace.find().sort({ createdAt: -1 }).lean(),
    Membership.aggregate([{ $group: { _id: "$workspace", count: { $sum: 1 } } }]),
    Transaction.aggregate([
      { $match: { voided: { $ne: true } } },
      { $group: { _id: "$workspace", count: { $sum: 1 } } },
    ]),
  ]);

  const members = new Map(memberCounts.map((m) => [String(m._id), m.count]));
  const txs = new Map(txCounts.map((t) => [String(t._id), t.count]));

  res.json(
    workspaces.map((w) => ({
      _id: w._id,
      name: w.name,
      kind: w.kind,
      currency: w.currency,
      createdAt: w.createdAt,
      members: members.get(String(w._id)) || 0,
      transactions: txs.get(String(w._id)) || 0,
    }))
  );
});
