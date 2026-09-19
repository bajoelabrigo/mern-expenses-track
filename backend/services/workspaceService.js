const Workspace = require("../model/Workspace");
const Membership = require("../model/Membership");
const User = require("../model/User");

//! Crea un espacio y hace propietario a quien lo crea. Si el alta de la
//! membresía falla se borra el espacio: un espacio sin propietario no lo puede
//! abrir nadie.
const createWorkspace = async ({ name, kind, currency, owner }) => {
  const workspace = await Workspace.create({
    name,
    kind,
    currency,
    createdBy: owner._id,
  });

  try {
    await Membership.create({
      workspace: workspace._id,
      user: owner._id,
      role: "propietario",
    });
  } catch (err) {
    await workspace.deleteOne();
    throw err;
  }

  return workspace;
};

//! Espacio personal del usuario; lo crea si todavía no tiene.
const ensurePersonalWorkspace = async (user) => {
  const owned = await Membership.find({ user: user._id, role: "propietario" })
    .select("workspace")
    .lean();

  const personal = await Workspace.findOne({
    _id: { $in: owned.map((m) => m.workspace) },
    kind: "personal",
  });
  if (personal) return personal;

  return createWorkspace({
    name: "Mis finanzas",
    kind: "personal",
    owner: user,
  });
};

//! Espacios del usuario con su rol, en el orden en que se muestran: primero el
//! predeterminado, luego por nombre.
const listUserWorkspaces = async (user) => {
  const memberships = await Membership.find({ user: user._id })
    .populate("workspace")
    .lean();

  const defaultId = user.defaultWorkspace ? String(user.defaultWorkspace) : null;

  return memberships
    .filter((m) => m.workspace)
    .map((m) => ({ workspace: m.workspace, role: m.role }))
    .sort((a, b) => {
      if (String(a.workspace._id) === defaultId) return -1;
      if (String(b.workspace._id) === defaultId) return 1;
      return a.workspace.name.localeCompare(b.workspace.name, "es");
    });
};

//! Si el espacio predeterminado del usuario ya no le pertenece (lo sacaron, se
//! borró), se elige otro de los suyos o se le crea el personal.
const repairDefaultWorkspace = async (user) => {
  if (user.defaultWorkspace) {
    const stillMember = await Membership.exists({
      user: user._id,
      workspace: user.defaultWorkspace,
    });
    if (stillMember) return user.defaultWorkspace;
  }

  const any = await Membership.findOne({ user: user._id }).sort({ createdAt: 1 });
  const workspaceId = any
    ? any.workspace
    : (await ensurePersonalWorkspace(user))._id;

  await User.updateOne({ _id: user._id }, { defaultWorkspace: workspaceId });
  user.defaultWorkspace = workspaceId;
  return workspaceId;
};

module.exports = {
  createWorkspace,
  ensurePersonalWorkspace,
  listUserWorkspaces,
  repairDefaultWorkspace,
};
