// One QueryClient for the whole app; the provider in app/_layout.tsx uses this instance.
// Retries only network/server errors: a 403 or 404 won't fix itself.
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: (count, error: any) => count < 2 && !(error?.status >= 400 && error?.status < 500),
    },
  },
});
