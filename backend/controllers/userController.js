const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../model/User");
const Membership = require("../model/Membership");
const { createWorkspace } = require("../services/workspaceService");
const { sendMail, simpleEmail } = require("../utils/mailer");
const { CURRENCIES } = require("../utils/money");
const {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  COOKIE_MAX_AGE_MS,
  COOKIE_SAMESITE,
  isProduction,
  MIN_PASSWORD_LENGTH,
  APP_URL,
} = require("../config/env");

//! Validez del enlace para restablecer la contraseña
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//! Datos públicos del usuario (nunca incluyen el hash de la contraseña)
const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  defaultWorkspace: user.defaultWorkspace || null,
});

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, v: user.tokenVersion || 0 }, JWT_SECRET, {
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
  //! Registro. Siempre crea el espacio personal; si se indica una iglesia,
  //! crea también su espacio y lo deja como predeterminado.
  register: asyncHandler(async (req, res) => {
    let { username, email, password, iglesia, currency } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ message: "Nombre de usuario, correo y contraseña son obligatorios" });
    }

    email = String(email).toLowerCase().trim();
    username = String(username).trim();
    iglesia = iglesia ? String(iglesia).trim() : "";

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

    if (iglesia && iglesia.length < 2) {
      return res.status(400).json({
        message: "El nombre de la iglesia debe tener al menos 2 caracteres",
      });
    }

    if (currency !== undefined && !CURRENCIES.includes(currency)) {
      return res.status(400).json({ message: "Moneda no admitida" });
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
    });

    const personal = await createWorkspace({
      name: "Mis finanzas",
      kind: "personal",
      currency,
      owner: userCreated,
    });

    let defaultWorkspace = personal;
    if (iglesia) {
      defaultWorkspace = await createWorkspace({
        name: iglesia,
        kind: "iglesia",
        currency,
        owner: userCreated,
      });
    }

    userCreated.defaultWorkspace = defaultWorkspace._id;
    await userCreated.save();

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
    //! Invalida cualquier sesión abierta con la contraseña anterior
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
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

  //! Elegir el espacio que se abre al iniciar sesión
  setDefaultWorkspace: asyncHandler(async (req, res) => {
    const { workspaceId } = req.body;

    const isMember =
      workspaceId &&
      (await Membership.exists({ user: req.user._id, workspace: workspaceId }));
    if (!isMember) {
      return res.status(403).json({ message: "No perteneces a ese espacio" });
    }

    req.user.defaultWorkspace = workspaceId;
    await User.updateOne({ _id: req.user._id }, { defaultWorkspace: workspaceId });

    res.status(200).json({
      message: "Espacio predeterminado actualizado",
      user: publicUser(req.user),
    });
  }),

  //! Pedir el enlace para restablecer la contraseña. Responde lo mismo exista o
  //! no la cuenta: si no, serviría para averiguar qué correos están registrados.
  forgotPassword: asyncHandler(async (req, res) => {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const generic = {
      message:
        "Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.",
    };

    if (!EMAIL_REGEX.test(email)) {
      return res.status(200).json(generic);
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(200).json(generic);

    const token = crypto.randomBytes(32).toString("hex");
    await User.updateOne(
      { _id: user._id },
      {
        passwordResetTokenHash: hashToken(token),
        passwordResetExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      }
    );

    const url = `${APP_URL}/restablecer-contrasena/${token}`;
    await sendMail({
      to: user.email,
      subject: "Restablecer tu contraseña",
      ...simpleEmail({
        title: "Restablecer tu contraseña",
        intro: `Hola ${user.username}, recibimos una solicitud para cambiar tu contraseña. El enlace vale durante 1 hora.`,
        buttonText: "Elegir una contraseña nueva",
        url,
        footer: "Si no fuiste tú, ignora este correo: tu contraseña no cambia.",
      }),
    });

    res.status(200).json(generic);
  }),

  //! Fijar una contraseña nueva con el enlace del correo
  resetPassword: asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "La nueva contraseña es obligatoria" });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      });
    }

    const user = await User.findOne({
      passwordResetTokenHash: hashToken(String(token || "")),
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: "El enlace no es válido o ya caducó. Pide uno nuevo.",
        code: "INVALID_RESET_TOKEN",
      });
    }

    user.password = await bcrypt.hash(password, 12);
    //! Cierra las sesiones abiertas con la contraseña anterior
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
      message: "Contraseña actualizada. Ya puedes iniciar sesión.",
    });
  }),
};

module.exports = usersController;
