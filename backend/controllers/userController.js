const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../model/User");

const usersController = {
  //! Register
  register: asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existUser = await User.findOne({ email });
    if (existUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userCreated = await User.create({
      email,
      username,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: userCreated._id,
        username: userCreated.username,
        email: userCreated.email,
      },
    });
  }),

  //! Login
  login: asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid login credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid login credentials" });
    }

    const token = jwt.sign({ id: user._id }, "masynctechKey", {
      expiresIn: "30d",
    });

    // Guardar el token como cookie segura
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // cambia a true en producción HTTPS
      sameSite: "Lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
    });

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
      },
    });
  }),

  //! Get user profile
  profile: asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      username: user.username,
      email: user.email,
    });
  }),

  //! Change password
  changeUserPassword: asyncHandler(async (req, res) => {
    const { newPassword } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;

    await user.save({ validateBeforeSave: false });

    res.status(200).json({ message: "Password changed successfully" });
  }),

  //! Update user profile
  updateUserProfile: asyncHandler(async (req, res) => {
    const { email, username } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { email, username },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User profile updated successfully",
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        username: updatedUser.username,
      },
    });
  }),
};

module.exports = usersController;
