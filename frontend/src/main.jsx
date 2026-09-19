import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import App from "./App.jsx";
import "./index.css";
import { store } from "./redux/store/store.js";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";
import { wakeApi } from "./lib/wakeApi.js";
import { watchSystemTheme } from "./lib/theme.js";
import QueryProvider from "./components/common/QueryProvider.jsx";

//! El hosting gratuito duerme la API: se la despierta al abrir la web
wakeApi();

//! Tema claro/oscuro: seguir al teléfono aunque cambie con la app abierta
watchSystemTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <QueryProvider>
          <App />
          {/* Las devtools solo se incluyen en desarrollo */}
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryProvider>
      </Provider>
    </ErrorBoundary>
  </StrictMode>
);
