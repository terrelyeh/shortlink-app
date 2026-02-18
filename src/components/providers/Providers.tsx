"use client";

import { SessionProvider } from "next-auth/react";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ToastProvider } from "@/components/ui/Toast";
import { Session } from "next-auth";

interface ProvidersProps {
  children: React.ReactNode;
  session: Session | null;
}

export function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session}>
      <WorkspaceProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </WorkspaceProvider>
    </SessionProvider>
  );
}
