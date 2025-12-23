import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

import { authConfig, type UserRole } from "./auth.config";

// Re-export for backwards compatibility
export type { UserRole } from "./auth.config";

/**
 * Full auth config with providers and database-dependent callbacks
 * This is used by the auth handler (Node.js runtime)
 */
export const fullAuthConfig: NextAuthConfig = {
  ...authConfig,
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
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user by email
        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (!user || !user.hashedPassword) {
          return null;
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.hashedPassword);

        if (!passwordMatch) {
          return null;
        }

        // Check if user is active
        if (!user.isActive || user.status !== "active") {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          role: user.role as UserRole,
          companyId: user.companyId,
        };
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
          if (!existingUser.isActive || existingUser.status !== "active") {
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
          user.companyId = existingUser.companyId;
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
