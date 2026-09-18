import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    //! Separa las librerías pesadas para que el bundle inicial no las cargue
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["chart.js", "react-chartjs-2"],
          emoji: ["emoji-picker-react"],
          forms: ["formik", "yup"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    css: false,
  },
});
