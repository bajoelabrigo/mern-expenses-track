import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

//! Color de la app instalada: la barra del sistema y el fondo de su pantalla
//! de carga. Es el oscuro, que es como abre la app mientras no se elija otra
//! cosa (src/lib/theme.js). El manifest no puede seguir al tema elegido: se
//! lee al instalar. También está en index.html y en el icono.
const THEME_COLOR = "#0e0e0e";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    //! App instalable: manifest + service worker que guarda la app en el
    //! dispositivo para que abra al instante y sin conexión.
    VitePWA({
      //! La versión nueva se instala en segundo plano y la app PREGUNTA antes de
      //! recargar (UpdatePrompt): recargar sola podría perder un formulario a
      //! medio llenar.
      registerType: "prompt",
      includeAssets: ["favicon.ico", "icon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Control de Gastos",
        short_name: "Gastos",
        description:
          "Ingresos y gastos personales y de tu iglesia, con roles, invitaciones e historial.",
        lang: "es",
        dir: "ltr",
        start_url: "/dashboard",
        scope: "/",
        id: "/",
        display: "standalone",
        orientation: "any",
        theme_color: THEME_COLOR,
        background_color: THEME_COLOR,
        categories: ["finance", "productivity"],
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        //! Al mantener pulsado el icono en Android
        shortcuts: [
          {
            name: "Agregar movimiento",
            short_name: "Agregar",
            url: "/add-transaction",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        //! Cualquier ruta de la app abre index.html también sin conexión
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        //! Borra las cachés de versiones anteriores del service worker
        cleanupOutdatedCaches: true,
        //! La API NO se cachea aquí: sus respuestas dependen de la sesión y del
        //! espacio (cabeceras que la caché del service worker no distingue).
        //! Los datos sin conexión los guarda React Query (ver main.jsx).
      },
      devOptions: { enabled: false },
    }),
  ],
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
