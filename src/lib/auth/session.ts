import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

import { auth } from "./index";
import type { UserRole } from "./config";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  companyId: string | null;
}

/**
 * Get the current session
 */
export async function getSession() {
  return await auth();
}

/**
 * Get the current user from session
 */
export async function getUser(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Get full user data from database
 */
export async function getFullUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    with: {
      company: true,
    },
  });

  return user;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  return await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  return await db.query.users.findFirst({
    where: eq(users.email, email),
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await auth();
  return !!session?.user;
}

/**
 * Check if user has a specific role
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === role;
}

/**
 * Check if user belongs to a company
 */
export async function belongsToCompany(companyId: string): Promise<boolean> {
  const session = await auth();

  if (!session?.user) {
    return false;
  }

  // Master admins have access to all companies
  if (session.user.role === "master_admin") {
    return true;
  }

  return session.user.companyId === companyId;
}
