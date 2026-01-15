import { redirect } from "next/navigation";
import { eq, isNull } from "drizzle-orm";

import { auth } from "./index";
import { db } from "@/lib/db";
import { companyPermissions, companies, type Company } from "@/lib/db/schema";
import { getCachedCompanyPermission } from "@/lib/redis/permissions";
import type { CompanyPermissionRole, UserRole } from "./role-utils";
import { getActiveCompanyId, clearActiveCompany } from "./tenant";

// Re-export role utilities for convenience
export {
  getDashboardUrl,
  getCompanyDashboardUrl,
  getRoleDisplayName,
  hasCompanyPermission,
  isMasterAdmin,
  isCompanyAdmin,
  isSupportAgent,
  type UserRole,
  type CompanyPermissionRole,
  type EffectiveRole,
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

  if (user.role !== "chatapp.master_admin") {
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Get the user's permission for a specific company
 * Uses Redis cache when available, falls back to database
 * Returns null if user has no permission
 */
export async function getCompanyPermission(
  userId: string,
  companyId: string
): Promise<CompanyPermissionRole | null> {
  // Use cached version which handles cache miss gracefully
  return getCachedCompanyPermission(userId, companyId);
}

/**
 * Get all companies the user has access to
 */
export async function getUserCompanies(userId: string) {
  const permissions = await db.query.companyPermissions.findMany({
    where: eq(companyPermissions.userId, userId),
    with: {
      company: true,
    },
  });

  return permissions.map((p) => ({
    company: p.company,
    role: p.role as CompanyPermissionRole,
  }));
}

/**
 * Require company admin role for a specific company
 * Master admins are automatically allowed
 */
export async function requireCompanyAdminFor(companyId: string) {
  const user = await requireAuth();

  // Master admins have god mode access everywhere
  if (user.role === "chatapp.master_admin") {
    return { user, permissionRole: "chatapp.company_admin" as CompanyPermissionRole };
  }

  // Regular users need company_admin permission for this company
  const permission = await getCompanyPermission(user.id, companyId);

  if (!permission || permission !== "chatapp.company_admin") {
    redirect("/unauthorized");
  }

  return { user, permissionRole: permission };
}

/**
 * Require company admin role using cookie-based company selection
 * Returns user AND company context
 */
export async function requireCompanyAdmin(): Promise<{
  user: { id: string; email: string; name: string | null; avatarUrl: string | null; role: UserRole };
  company: Company;
  permissionRole: CompanyPermissionRole;
}> {
  const user = await requireAuth();

  const companyId = await getActiveCompanyId();
  if (!companyId) {
    redirect("/companies");
  }

  // Get company
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  if (!company) {
    await clearActiveCompany();
    redirect("/companies");
  }

  // Master admins have god mode access everywhere
  if (user.role === "chatapp.master_admin") {
    return {
      user,
      company,
      permissionRole: "chatapp.company_admin" as CompanyPermissionRole,
    };
  }

  // Regular users need company_admin permission for this company
  const permission = await getCompanyPermission(user.id, companyId);

  if (!permission || permission !== "chatapp.company_admin") {
    await clearActiveCompany();
    redirect("/unauthorized");
  }

  return { user, company, permissionRole: permission };
}

/**
 * Require support agent role (or higher) for a specific company
 * Master admins and company admins are automatically allowed
 */
export async function requireSupportAgentFor(companyId: string) {
  const user = await requireAuth();

  // Master admins have god mode access everywhere
  if (user.role === "chatapp.master_admin") {
    return { user, permissionRole: "chatapp.company_admin" as CompanyPermissionRole };
  }

  // Regular users need at least support_agent permission for this company
  const permission = await getCompanyPermission(user.id, companyId);

  if (!permission) {
    redirect("/unauthorized");
  }

  // Both company_admin and support_agent can access
  return { user, permissionRole: permission };
}

/**
 * Require support agent role using cookie-based company selection
 * Returns user AND company context
 */
export async function requireSupportAgent(): Promise<{
  user: { id: string; email: string; name: string | null; avatarUrl: string | null; role: UserRole };
  company: Company;
  permissionRole: CompanyPermissionRole;
}> {
  const user = await requireAuth();

  const companyId = await getActiveCompanyId();
  if (!companyId) {
    redirect("/companies");
  }

  // Get company
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  if (!company) {
    await clearActiveCompany();
    redirect("/companies");
  }

  // Master admins have god mode access everywhere
  if (user.role === "chatapp.master_admin") {
    return {
      user,
      company,
      permissionRole: "chatapp.company_admin" as CompanyPermissionRole,
    };
  }

  // Regular users need at least support_agent permission for this company
  const permission = await getCompanyPermission(user.id, companyId);

  if (!permission) {
    await clearActiveCompany();
    redirect("/unauthorized");
  }

  // Both company_admin and support_agent can access
  return { user, company, permissionRole: permission };
}

/**
 * Require any access to a specific company
 */
export async function requireCompanyAccessFor(companyId: string) {
  const user = await requireAuth();

  // Master admins have access to all companies
  if (user.role === "chatapp.master_admin") {
    return { user, permissionRole: null as CompanyPermissionRole | null };
  }

  // Other users must have a permission entry for this company
  const permission = await getCompanyPermission(user.id, companyId);

  if (!permission) {
    redirect("/unauthorized");
  }

  return { user, permissionRole: permission };
}

/**
 * Require any access to active company (cookie-based)
 */
export async function requireCompanyAccess(): Promise<{
  user: { id: string; email: string; name: string | null; avatarUrl: string | null; role: UserRole };
  company: Company;
  permissionRole: CompanyPermissionRole | null;
}> {
  const user = await requireAuth();

  const companyId = await getActiveCompanyId();
  if (!companyId) {
    redirect("/companies");
  }

  // Get company
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  if (!company) {
    await clearActiveCompany();
    redirect("/companies");
  }

  // Master admins have access to all companies
  if (user.role === "chatapp.master_admin") {
    return {
      user,
      company,
      permissionRole: "chatapp.company_admin" as CompanyPermissionRole,
    };
  }

  // Other users must have a permission entry for this company
  const permission = await getCompanyPermission(user.id, companyId);

  if (!permission) {
    await clearActiveCompany();
    redirect("/unauthorized");
  }

  return { user, company, permissionRole: permission };
}

/**
 * Check if user can create agents (only master_admin)
 */
export async function canCreateAgent(userRole: UserRole): Promise<boolean> {
  return userRole === "chatapp.master_admin";
}

/**
 * Check if user can edit agent AI settings (only master_admin)
 * AI settings include: system prompt, model, temperature, tools
 */
export async function canEditAgentAISettings(userRole: UserRole): Promise<boolean> {
  return userRole === "chatapp.master_admin";
}

/**
 * Check if user can edit basic agent settings
 * Company admins can edit: name, description, greeting, behavior toggles
 */
export async function canEditBasicAgentSettings(
  userRole: UserRole,
  companyId: string,
  userId: string
): Promise<boolean> {
  if (userRole === "chatapp.master_admin") {
    return true;
  }

  const permission = await getCompanyPermission(userId, companyId);
  return permission === "chatapp.company_admin";
}

/**
 * Get current user or null (doesn't redirect)
 */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Get current user with their companies (doesn't redirect)
 */
export async function getCurrentUserWithCompanies() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  // Master admins get all companies
  if (user.role === "chatapp.master_admin") {
    const allCompanies = await db.query.companies.findMany({
      where: isNull(companies.deletedAt),
    });

    return {
      user,
      companies: allCompanies.map((c) => ({
        company: c,
        role: "chatapp.company_admin" as CompanyPermissionRole,
      })),
    };
  }

  // Regular users get companies from permissions
  const userCompanies = await getUserCompanies(user.id);

  return { user, companies: userCompanies };
}
