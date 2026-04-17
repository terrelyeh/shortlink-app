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
      // Optional: Restrict to a specific email whitelist
      // Set ALLOWED_EMAILS="a@x.com,b@y.com" — leave empty to allow any Google account.
      const raw = process.env.ALLOWED_EMAILS;
      if (!raw) return true;

      const whitelist = raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (whitelist.length === 0) return true;
      if (!user.email) return false;

      return whitelist.includes(user.email.toLowerCase());
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});
