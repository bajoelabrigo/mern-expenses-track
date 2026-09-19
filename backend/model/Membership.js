const mongoose = require("mongoose");
const { ROLES } = require("../utils/permissions");

//! Pertenencia de un usuario a un espacio, con su rol.
const membershipSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: { values: ROLES, message: "Rol no válido" },
      required: true,
    },
  },
  { timestamps: true }
);

membershipSchema.index({ workspace: 1, user: 1 }, { unique: true });
membershipSchema.index({ user: 1 });

module.exports = mongoose.model("Membership", membershipSchema);
