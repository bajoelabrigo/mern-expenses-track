const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../model/User");

const usersController = {
  //! Register mejorado
  register: asyncHandler(async (req, res) => {
    let { username, email, password, iglesia } = req.body;

    // 🔍 Validación básica
    if (!username || !email || !password || !iglesia) {
      return res
        .status(400)
        .json({ message: "Todos los campos son obligatorios" });
    }

    // 🔠 Normalizar el correo
    email = email.toLowerCase().trim();

    // 🧪 Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Formato de correo inválido" });
    }

    // 🔐 Validar fuerza de la contraseña
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "La contraseña debe tener al menos 6 caracteres" });
    }

    // 🔎 Verificar si el usuario ya existe
    const existUser = await User.findOne({ email });
    if (existUser) {
      return res
        .status(400)
        .json({ message: "El usuario ya existe con ese correo" });
    }

    // 🔑 Encriptar la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 📝 Crear el usuario
    const userCreated = await User.create({
      email,
      username,
      password: hashedPassword,
      iglesia,
    });

    // ✅ Responder con datos útiles del usuario
    res.status(201).json({
      message: "Usuario registrado exitosamente",
      user: {
        id: userCreated._id,
        username: userCreated.username,
        email: userCreated.email,
        role: userCreated.role,
        iglesia: userCreated.iglesia,
      },
    });

    // 📨 (Opcional) Aquí podrías enviar un correo de bienvenida o verificación
  }),

  //! Login
  login: asyncHandler(async (req, res) => {
    let { email, password } = req.body;

    // 🔍 Validar campos requeridos
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Todos los campos son obligatorios" });
    }

    // 🔠 Normalizar correo
    email = email.toLowerCase().trim();

    // 🧪 Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Formato de correo inválido" });
    }

    // 🔎 Buscar usuario
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // 🔐 Comparar contraseñas
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // 🔑 Generar token JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // 🍪 Guardar token en cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // solo en HTTPS
      sameSite: "Lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
    });

    // ✅ Enviar datos del usuario
    res.status(200).json({
      message: "Inicio de sesión exitoso",
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        iglesia: user.iglesia,
      },
    });
  }),

  //! Obtener perfil del usuario autenticado
  profile: asyncHandler(async (req, res) => {
    // ✅ Validar ID de usuario (por seguridad adicional)
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      iglesia: user.iglesia,
    });
  }),

  //! Cambiar contraseña del usuario autenticado
  changeUserPassword: asyncHandler(async (req, res) => {
    const { newPassword } = req.body;

    // ✅ Validar presencia del campo
    if (!newPassword || typeof newPassword !== "string") {
      return res
        .status(400)
        .json({ message: "La nueva contraseña es obligatoria" });
    }

    // 🔐 Validar longitud mínima (puedes agregar más reglas si deseas)
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "La contraseña debe tener al menos 6 caracteres" });
    }

    // 🔎 Buscar al usuario autenticado
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // 🔑 Encriptar la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;

    // 💾 Guardar sin validaciones innecesarias
    await user.save({ validateBeforeSave: false });

    // 🟡 (Opcional) Invalida tokens antiguos o fuerza re-login

    res.status(200).json({ message: "Contraseña actualizada exitosamente" });
  }),

  //! Actualizar perfil del usuario autenticado
  updateUserProfile: asyncHandler(async (req, res) => {
    const { email, username } = req.body;

    // ✅ Validar que al menos uno de los campos esté presente
    if (!email && !username) {
      return res.status(400).json({
        message: "Debes proporcionar un nuevo email o nombre de usuario",
      });
    }

    const updates = {};

    // 🔠 Normalizar y validar email si se envió
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ message: "Formato de correo inválido" });
      }

      // 🔎 Verificar si el email ya está en uso por otro usuario
      const existingEmailUser = await User.findOne({ email: normalizedEmail });
      if (
        existingEmailUser &&
        existingEmailUser._id.toString() !== req.user._id.toString()
      ) {
        return res
          .status(409)
          .json({ message: "Este correo ya está en uso por otro usuario" });
      }

      updates.email = normalizedEmail;
    }

    // 📝 Validar y asignar nuevo username si se envió
    if (username) {
      updates.username = username.trim();
      if (updates.username.length < 3) {
        return res.status(400).json({
          message: "El nombre de usuario debe tener al menos 3 caracteres",
        });
      }
    }

    // 🔄 Actualizar usuario
    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json({
      message: "Perfil actualizado exitosamente",
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        username: updatedUser.username,
        role: updatedUser.role,
        iglesia: updatedUser.iglesia,
      },
    });
  }),
};

module.exports = usersController;
