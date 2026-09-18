import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import App from "./App.jsx";
import "./index.css";
import { store } from "./redux/store/store.js";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";

const client = new QueryClient({
  defaultOptions: {
    queries: {
      //! Los 401 no se reintentan: el interceptor ya redirige al login
      retry: (failureCount, error) =>
        error?.response?.status === 401 ? false : failureCount < 2,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={client}>
          <App />
          {/* Las devtools solo se incluyen en desarrollo */}
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  </StrictMode>
);
