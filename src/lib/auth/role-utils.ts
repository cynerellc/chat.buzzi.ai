/**
 * User role type for the multi-tenant system
 */
export type UserRole = "master_admin" | "company_admin" | "support_agent";

/**
 * Check if user has a specific role (or higher in the hierarchy)
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    master_admin: 3,
    company_admin: 2,
    support_agent: 1,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Get human-readable role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    master_admin: "Master Admin",
    company_admin: "Company Admin",
    support_agent: "Support Agent",
  };

  return roleNames[role];
}

/**
 * Get dashboard URL based on role
 */
export function getDashboardUrl(role: UserRole): string {
  switch (role) {
    case "master_admin":
      return "/admin/dashboard";
    case "company_admin":
      return "/dashboard";
    case "support_agent":
      return "/inbox";
    default:
      return "/dashboard";
  }
}
