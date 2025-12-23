import { redirect } from "next/navigation";

import { auth } from "./index";

// Re-export role utilities for convenience
export {
  getDashboardUrl,
  getRoleDisplayName,
  hasRole,
  type UserRole,
} from "./role-utils";

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Require authentication - throws if not authenticated
 * Use in Server Components and Server Actions
 */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
}

/**
 * Require master admin role
 */
export async function requireMasterAdmin() {
  const user = await requireAuth();

  if (user.role !== "master_admin") {
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Require company admin role
 */
export async function requireCompanyAdmin() {
  const user = await requireAuth();

  if (user.role !== "company_admin" && user.role !== "master_admin") {
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Require support agent role (or higher)
 */
export async function requireSupportAgent() {
  const user = await requireAuth();

  // All authenticated users have at least support agent access
  if (!["master_admin", "company_admin", "support_agent"].includes(user.role)) {
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Require access to a specific company
 */
export async function requireCompanyAccess(companyId: string) {
  const user = await requireAuth();

  // Master admins have access to all companies
  if (user.role === "master_admin") {
    return user;
  }

  // Other users must belong to the company
  if (user.companyId !== companyId) {
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Get current user or null (doesn't redirect)
 */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

