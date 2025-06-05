const isAdmin = (req, res, next) => {
  console.log("User from token:", req.user);
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    console.warn("Unauthorized access attempt:", req.user);
    res.status(403).json({ message: "Admin access only" });
  }
};

module.exports = isAdmin;
