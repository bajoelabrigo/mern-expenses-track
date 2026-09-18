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
    iglesia: {
      type: String,
      required: [true, "La iglesia es obligatoria"],
      trim: true,
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
  },
  {
    timestamps: true,
  }
);

//! Nunca exponer el hash aunque alguien serialice el documento
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
