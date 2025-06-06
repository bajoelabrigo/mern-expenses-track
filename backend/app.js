const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const errorHandler = require("./middlewares/errorHandlerMiddleware");
const dotenv = require("dotenv");
const userRouter = require("./routes/userRouter");
const categoryRouter = require("./routes/categoryRouter");
const transactionRouter = require("./routes/transactionRouter");
const adminRouter = require("./routes/adminRoutes");
const path = require("path");

const app = express();
dotenv.config();

//! Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("DB connected"))
  .catch((e) => console.error("DB connection error:", e));

//! Cors config
const corsOptions = {
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight support

//! Middlewares
app.use(cookieParser());
app.use(express.json()); // Parse incoming JSON

//! Routes
app.use("/", userRouter);
app.use("/", categoryRouter);
app.use("/", transactionRouter);
app.use("/api/v1/admin", adminRouter);

//! Error handler
app.use(errorHandler);

//! Serve frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

//! Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
