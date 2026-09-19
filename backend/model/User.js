const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "El nombre de usuario es obligatorio"],
      unique: true,
      trim: true,
      minlength: [3, "El nombre de usuario debe tener al menos 3 caracteres"],
    },
    email: {
      type: String,
      required: [true, "El correo es obligatorio"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    //! Nombre de la iglesia con el que se registró (dato histórico). Desde la
    //! fase 1 la iglesia es un Workspace; este campo solo lo lee la migración.
    iglesia: {
      type: String,
      trim: true,
    },
    //! Espacio que se abre al iniciar sesión si el cliente no pide otro
    defaultWorkspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    password: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
      select: false, // nunca se devuelve salvo que se pida explícitamente
    },
    role: {
      type: String,
      required: true,
      enum: ["admin", "user"],
      default: "user",
    },
    //! Marca temporal usada para invalidar tokens emitidos antes del cambio
    passwordChangedAt: {
      type: Date,
    },
    //! Versión de las sesiones: cada cambio de contraseña la incrementa y los
    //! tokens con una versión anterior dejan de valer. Compararlo por fecha
    //! falla dentro del mismo segundo (el "iat" del JWT va en segundos).
    tokenVersion: {
      type: Number,
      default: 0,
    },
    //! Recuperación de contraseña: solo el hash del token, con caducidad
    passwordResetTokenHash: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

//! Nunca exponer el hash aunque alguien serialice el documento
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.passwordResetTokenHash;
    delete ret.passwordResetExpires;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
