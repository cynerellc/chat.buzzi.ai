import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { Adapter } from "next-auth/adapters";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";

import { authConfig, type UserRole } from "./auth.config";

// Re-export for backwards compatibility
export type { UserRole } from "./auth.config";

/**
 * Full auth config with providers and database-dependent callbacks
 * This is used by the auth handler (Node.js runtime)
 */
export const fullAuthConfig: NextAuthConfig = {
  ...authConfig,
  /* eslint-disable @typescript-eslint/no-explicit-any */
  adapter: DrizzleAdapter(db as any, {
    usersTable: users as any,
    accountsTable: accounts as any,
    sessionsTable: sessions as any,
    verificationTokensTable: verificationTokens as any,
  }) as Adapter,
  /* eslint-enable @typescript-eslint/no-explicit-any */
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    // Magic Link via Resend
    Resend({
      apiKey: process.env.RESEND_API_KEY ?? "",
      from: process.env.EMAIL_FROM ?? "noreply@example.com",
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("[Auth] authorize called with:", { email: credentials?.email });

        if (!credentials?.email || !credentials?.password) {
          console.log("[Auth] Missing email or password");
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user by email
        console.log("[Auth] Finding user by email:", email);
        try {
          const user = await db.query.users.findFirst({
            where: eq(users.email, email),
          });

          console.log("[Auth] User query result:", user ? {
            id: user.id,
            email: user.email,
            hasPassword: !!user.hashedPassword,
            status: user.status,
          } : "not found");

          if (!user || !user.hashedPassword) {
            console.log("[Auth] User not found or no password");
            return null;
          }

          // Verify password
          console.log("[Auth] Password received length:", password.length, "chars");
          console.log("[Auth] Password first 3 chars:", password.substring(0, 3));
          const passwordMatch = await bcrypt.compare(password, user.hashedPassword);
          console.log("[Auth] Password match:", passwordMatch);

          if (!passwordMatch) {
            console.log("[Auth] Password mismatch");
            return null;
          }

          // Check if user is active
          if (user.status !== "active") {
            console.log("[Auth] User not active:", { status: user.status });
            return null;
          }

          console.log("[Auth] Login successful for:", email);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role as UserRole,
          };
        } catch (error) {
          console.error("[Auth] Error during authorize:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // For OAuth providers, check if user exists and is active
      if (account?.provider !== "credentials" && user.email) {
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, user.email),
        });

        if (existingUser) {
          // Check if user is active
          if (existingUser.status !== "active") {
            return false;
          }

          // Update last login
          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, existingUser.id));

          // Attach user data
          user.id = existingUser.id;
          user.role = existingUser.role as UserRole;
        } else {
          // For new OAuth users, we could create them here
          // For now, return false to prevent sign-in (they need to be invited)
          return false;
        }
      } else if (account?.provider === "credentials" && user.id) {
        // For credentials, update last login
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));
      }

      return true;
    },
  },
};
