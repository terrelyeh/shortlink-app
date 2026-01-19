"use client";

import { SessionProvider } from "next-auth/react";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { Session } from "next-auth";

interface ProvidersProps {
  children: React.ReactNode;
  session: Session | null;
}

export function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session}>
      <WorkspaceProvider>
        {children}
      </WorkspaceProvider>
    </SessionProvider>
  );
}
