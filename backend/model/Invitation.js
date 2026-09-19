const mongoose = require("mongoose");
const { ROLES } = require("../utils/permissions");

//! Invitación a un espacio. Solo se guarda el HASH del token: quien lea la base
//! no puede usar las invitaciones pendientes.
const invitationSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    email: {
      type: String,
      required: [true, "El correo es obligatorio"],
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: { values: ROLES, message: "Rol no válido" },
      required: true,
    },
    tokenHash: { type: String, required: true, unique: true, select: false },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

invitationSchema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model("Invitation", invitationSchema);
