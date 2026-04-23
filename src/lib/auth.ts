import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { Adapter } from "next-auth/adapters";

type UserRole = "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
    };
  }

  interface User {
    role: UserRole;
  }
}

/**
 * Whether `email` is allowed to sign in.
 *
 * Three tiers of access (first match wins):
 *   1. BOOTSTRAP_EMAILS env var — for the first-ever OWNER and
 *      emergency recovery. Keep the list short (1–2 people).
 *   2. Already a WorkspaceMember — returning users.
 *   3. Has a pending WorkspaceInvitation (not expired / cancelled).
 *
 * Legacy: if ALLOWED_EMAILS is still set, it acts as a fourth allow
 * list so existing deployments don't lock themselves out during the
 * migration. Remove the env var once everyone has been re-invited.
 */
async function isAllowedToSignIn(email: string): Promise<boolean> {
  const lower = email.toLowerCase();

  // 1. Bootstrap access — always trusted.
  const bootstrap = (process.env.BOOTSTRAP_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (bootstrap.includes(lower)) return true;

  // 2. Already a member of any workspace.
  const existingMember = await prisma.workspaceMember.findFirst({
    where: { user: { email: lower } },
    select: { id: true },
  });
  if (existingMember) return true;

  // 3. Has a live invitation.
  const invitation = await prisma.workspaceInvitation.findFirst({
    where: {
      email: lower,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (invitation) return true;

  // 4. Deprecated fallback — remove once all users are re-invited.
  const legacy = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (legacy.includes(lower)) return true;

  return false;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return isAllowedToSignIn(user.email);
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
      }
      return session;
    },
  },
  events: {
    /**
     * When someone signs in, auto-accept any pending invitations for
     * their email so they land in a workspace without needing to also
     * click the /invite/<token> link. Idempotent: accepted invites are
     * filtered out by the status check.
     */
    async signIn({ user }) {
      if (!user.id || !user.email) return;

      const pending = await prisma.workspaceInvitation.findMany({
        where: {
          email: user.email.toLowerCase(),
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          workspaceId: true,
          role: true,
        },
      });

      if (pending.length === 0) return;

      // Create memberships one by one so a single duplicate (e.g. user
      // was already manually added to one of the workspaces) doesn't
      // abort the whole batch.
      for (const inv of pending) {
        try {
          await prisma.$transaction([
            prisma.workspaceMember.create({
              data: {
                workspaceId: inv.workspaceId,
                userId: user.id,
                role: inv.role,
              },
            }),
            prisma.workspaceInvitation.update({
              where: { id: inv.id },
              data: { status: "ACCEPTED", acceptedAt: new Date() },
            }),
            prisma.auditLog.create({
              data: {
                userId: user.id,
                action: "ACCEPT_INVITATION",
                targetId: inv.id,
                metadata: { workspaceId: inv.workspaceId, autoAccepted: true },
              },
            }),
          ]);
        } catch {
          // P2002 (unique violation on workspaceId_userId) — user was
          // already a member; just mark the invitation used.
          await prisma.workspaceInvitation.update({
            where: { id: inv.id },
            data: { status: "ACCEPTED", acceptedAt: new Date() },
          });
        }
      }
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});
