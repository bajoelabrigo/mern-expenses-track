import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  CACHE_BUSTER,
  CACHE_MAX_AGE,
  persister,
  queryClient,
  shouldPersistQuery,
} from "../../lib/queryClient.js";

//! Con almacenamiento disponible, los datos vistos se guardan en el dispositivo
const QueryProvider = ({ children }) =>
  persister ? (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        buster: CACHE_BUSTER,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  ) : (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

export default QueryProvider;
