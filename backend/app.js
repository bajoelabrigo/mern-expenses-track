const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const errorHandler = require("./middlewares/errorHandlerMiddleware");
const dotenv = require("dotenv");
const userRouter = require("./routes/userRouter");
const categoryRouter = require("./routes/categoryRouter");
const transactionRouter = require("./routes/transactionRouter");

const app = express();
dotenv.config();

//! Connect to mongodb
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("DB connected"))
  .catch((e) => console.log(e));

//! Cors config
const corsOptions = {
  origin: [
    "https://controldegastoschurch.netlify.app",
    "https://mern-expenses-track-frontend.onrender.com",
    "http://localhost:5173",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

app.options("*", cors(corsOptions)); // <-- para responder preflight correctamente

app.use(cookieParser()); // ✅ Esto es esencial

//!Middlewares
app.use(express.json()); //?Pass incoming json data

//!Routes
app.use("/", userRouter);
app.use("/", categoryRouter);
app.use("/", transactionRouter);
//!Error
app.use(errorHandler);

//!Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
