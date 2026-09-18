const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../model/User");
const {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  COOKIE_MAX_AGE_MS,
  COOKIE_SAMESITE,
  isProduction,
  MIN_PASSWORD_LENGTH,
} = require("../config/env");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//! Datos públicos del usuario (nunca incluyen el hash de la contraseña)
const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  iglesia: user.iglesia,
});

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

//! La cookie es un extra: el token también viaja en el body para clientes
//! alojados en otro dominio, donde SameSite bloquearía la cookie.
const cookieOptions = () => ({
  httpOnly: true,
  secure: isProduction || COOKIE_SAMESITE === "none",
  sameSite: COOKIE_SAMESITE,
  path: "/",
});

const usersController = {
  //! Registro
  register: asyncHandler(async (req, res) => {
    let { username, email, password, iglesia } = req.body;

    if (!username || !email || !password || !iglesia) {
      return res
        .status(400)
        .json({ message: "Todos los campos son obligatorios" });
    }

    email = String(email).toLowerCase().trim();
    username = String(username).trim();
    iglesia = String(iglesia).trim();

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: "Formato de correo inválido" });
    }

    if (username.length < 3) {
      return res.status(400).json({
        message: "El nombre de usuario debe tener al menos 3 caracteres",
      });
    }

    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      });
    }

    const existUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existUser) {
      return res.status(409).json({
        message:
          existUser.email === email
            ? "Ya existe una cuenta con ese correo"
            : "Ese nombre de usuario ya está en uso",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const userCreated = await User.create({
      email,
      username,
      password: hashedPassword,
      iglesia,
    });

    res.status(201).json({
      message: "Usuario registrado exitosamente",
      user: publicUser(userCreated),
    });
  }),

  //! Login
  login: asyncHandler(async (req, res) => {
    let { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Todos los campos son obligatorios" });
    }

    email = String(email).toLowerCase().trim();

    if (!EMAIL_REGEX.test(email)) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    //! El hash está marcado como select:false en el esquema
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const token = signToken(user);
    res.cookie("token", token, {
      ...cookieOptions(),
      maxAge: COOKIE_MAX_AGE_MS,
    });

    res.status(200).json({
      message: "Inicio de sesión exitoso",
      token, // el frontend lo guarda y lo envía como Bearer
      user: publicUser(user),
    });
  }),

  //! Cierre de sesión: limpia la cookie httpOnly
  logout: asyncHandler(async (req, res) => {
    res.clearCookie("token", cookieOptions());
    res.status(200).json({ message: "Sesión cerrada" });
  }),

  //! Perfil del usuario autenticado
  profile: asyncHandler(async (req, res) => {
    res.status(200).json(publicUser(req.user));
  }),

  //! Cambio de contraseña: exige la contraseña actual e invalida los tokens previos
  changeUserPassword: asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || typeof currentPassword !== "string") {
      return res
        .status(400)
        .json({ message: "Debes ingresar tu contraseña actual" });
    }

    if (!newPassword || typeof newPassword !== "string") {
      return res
        .status(400)
        .json({ message: "La nueva contraseña es obligatoria" });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({
        message: "La nueva contraseña debe ser distinta de la actual",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "La contraseña actual no es correcta" });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    //! Invalida cualquier token emitido antes de este instante
    user.passwordChangedAt = new Date();
    await user.save();

    res.clearCookie("token", cookieOptions());

    res.status(200).json({
      message: "Contraseña actualizada. Vuelve a iniciar sesión.",
    });
  }),

  //! Actualizar perfil (email / username)
  updateUserProfile: asyncHandler(async (req, res) => {
    const { email, username } = req.body;

    if (!email && !username) {
      return res.status(400).json({
        message: "Debes proporcionar un nuevo email o nombre de usuario",
      });
    }

    const updates = {};

    if (email) {
      const normalizedEmail = String(email).toLowerCase().trim();

      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({ message: "Formato de correo inválido" });
      }

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

    if (username) {
      const normalizedUsername = String(username).trim();
      if (normalizedUsername.length < 3) {
        return res.status(400).json({
          message: "El nombre de usuario debe tener al menos 3 caracteres",
        });
      }

      const existingUsername = await User.findOne({
        username: normalizedUsername,
      });
      if (
        existingUsername &&
        existingUsername._id.toString() !== req.user._id.toString()
      ) {
        return res
          .status(409)
          .json({ message: "Ese nombre de usuario ya está en uso" });
      }

      updates.username = normalizedUsername;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json({
      message: "Perfil actualizado exitosamente",
      user: publicUser(updatedUser),
    });
  }),
};

module.exports = usersController;
