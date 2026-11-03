import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { App } from "@/app";
import { ConfirmationProvider } from "@/components/ui/confirmation-provider";
import "@/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmationProvider>
        <App />
        <Toaster richColors position="top-right" />
      </ConfirmationProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
