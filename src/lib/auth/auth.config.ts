import type { NextAuthConfig } from "next-auth";

import type { UserRole } from "./role-utils";

// Re-export for backwards compatibility
export type { UserRole } from "./role-utils";

// Extend the NextAuth types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      role: UserRole;
    };
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: UserRole;
  }
}

/**
 * Base auth config without providers
 * This is used by middleware (Edge runtime compatible)
 */
export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [], // Providers are added in auth.ts
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        // Initial sign in - store user data in token
        token.id = user.id;
        token.role = user.role;
        token.name = user.name;
        token.email = user.email;
        token.image = user.image;
      }

      // When session is updated (via update() call), refresh user data from DB
      if (trigger === "update" && token.id) {
        try {
          // Dynamically import to avoid edge runtime issues
          const { db } = await import("@/lib/db");
          const { users } = await import("@/lib/db/schema/users");
          const { eq } = await import("drizzle-orm");

          const [freshUser] = await db
            .select({
              name: users.name,
              email: users.email,
              image: users.image,
              avatarUrl: users.avatarUrl,
              role: users.role,
            })
            .from(users)
            .where(eq(users.id, token.id as string))
            .limit(1);

          if (freshUser) {
            token.name = freshUser.name;
            token.email = freshUser.email;
            // Use avatarUrl if available, otherwise fallback to OAuth image
            token.image = freshUser.avatarUrl ?? freshUser.image;
            token.role = freshUser.role as UserRole;
          }
        } catch (error) {
          console.error("Failed to refresh user data in JWT callback:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.name = (token.name as string | null) ?? null;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.image = (token.image as string | null) ?? null;
      }

      return session;
    },
    async redirect({ url, baseUrl }) {
      // Handle relative URLs
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      // Handle same-origin URLs
      if (new URL(url).origin === baseUrl) {
        return url;
      }

      return baseUrl;
    },
  },
};
