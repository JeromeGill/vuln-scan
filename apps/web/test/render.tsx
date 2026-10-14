import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

/**
 * Renders `ui` with the parts of `app/providers.tsx` that containers rely
 * on: a QueryClient (fresh per test, no retries) and the toaster.
 */
export function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
      <Toaster />
    </QueryClientProvider>,
  );
}
