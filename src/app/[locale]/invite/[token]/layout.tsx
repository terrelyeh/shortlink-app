"use client";

/**
 * Invite landing page needs `useSession()` to know whether the visitor
 * is already logged in. That hook requires <SessionProvider> in the
 * tree — which the locale layout doesn't ship (only the dashboard
 * route group does). Without this layout the page crashes with a
 * client-side exception the moment it mounts.
 *
 * We deliberately keep this provider minimal (no Workspace / Query /
 * Toast wrappers) — the invite flow doesn't need them.
 */

import { SessionProvider } from "next-auth/react";

export default function InviteTokenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
