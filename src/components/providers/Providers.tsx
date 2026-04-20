"use client";

import { SessionProvider } from "next-auth/react";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ToastProvider } from "@/components/ui/Toast";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Session } from "next-auth";
import { makeQueryClient } from "@/lib/query/client";
import { installWorkspaceFetch } from "@/lib/fetch-workspace";

// Patch window.fetch to inject the current workspace id header on
// same-origin /api/* calls. Run at module load (top of the client
// bundle) so it's in place before any provider's mount effect fires
// its first request.
installWorkspaceFetch();

interface ProvidersProps {
  children: React.ReactNode;
  session: Session | null;
}

export function Providers({ children, session }: ProvidersProps) {
  // One QueryClient per browser tab — lazy-inited via useState so it
  // survives re-renders but resets on full page reload. Do NOT lift this
  // to module scope; that'd leak state across users in SSR edge cases.
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <WorkspaceProvider>
          <ToastProvider>{children}</ToastProvider>
        </WorkspaceProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
