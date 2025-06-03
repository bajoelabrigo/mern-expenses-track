export const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:8000/api/v1"
    : "https://mern-expenses-track.onrender.com/api/v1";
