import NextAuth from "next-auth";

import { fullAuthConfig } from "./config";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(fullAuthConfig);

// Re-export types
export type { UserRole } from "./auth.config";
