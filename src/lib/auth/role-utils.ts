/**
 * User role type - only two roles exist at the user level
 * - master_admin: Platform-wide god mode
 * - user: Regular user who accesses companies via company_permissions
 */
export type UserRole = "chatapp.master_admin" | "chatapp.user";

/**
 * Company permission role - assigned per-company via company_permissions table
 */
export type CompanyPermissionRole = "chatapp.company_admin" | "chatapp.support_agent";

/**
 * Effective role - can be user role or company permission role
 */
export type EffectiveRole = UserRole | CompanyPermissionRole;

/**
 * Check if user is a master admin
 */
export function isMasterAdmin(role: UserRole): boolean {
  return role === "chatapp.master_admin";
}

/**
 * Check if user role is a regular user
 */
export function isRegularUser(role: UserRole): boolean {
  return role === "chatapp.user";
}

/**
 * Check if a company permission role is company admin
 */
export function isCompanyAdmin(permissionRole: CompanyPermissionRole): boolean {
  return permissionRole === "chatapp.company_admin";
}

/**
 * Check if a company permission role is support agent
 */
export function isSupportAgent(permissionRole: CompanyPermissionRole): boolean {
  return permissionRole === "chatapp.support_agent";
}

/**
 * Check if company permission role has at least the required level
 * company_admin > support_agent
 */
export function hasCompanyPermission(
  userPermissionRole: CompanyPermissionRole,
  requiredRole: CompanyPermissionRole
): boolean {
  const permissionHierarchy: Record<CompanyPermissionRole, number> = {
    "chatapp.company_admin": 2,
    "chatapp.support_agent": 1,
  };

  return permissionHierarchy[userPermissionRole] >= permissionHierarchy[requiredRole];
}

/**
 * Get human-readable role display name
 */
export function getRoleDisplayName(role: EffectiveRole): string {
  const roleNames: Record<EffectiveRole, string> = {
    "chatapp.master_admin": "Master Admin",
    "chatapp.user": "User",
    "chatapp.company_admin": "Company Admin",
    "chatapp.support_agent": "Support Agent",
  };

  return roleNames[role];
}

/**
 * Get dashboard URL based on user role
 * For regular users, this is determined by their company permission
 */
export function getDashboardUrl(role: UserRole): string {
  if (role === "chatapp.master_admin") {
    return "/admin/dashboard";
  }
  // For regular users, redirect to company selection or dashboard
  return "/companies";
}

/**
 * Get company dashboard URL based on company permission role
 */
export function getCompanyDashboardUrl(permissionRole: CompanyPermissionRole): string {
  switch (permissionRole) {
    case "chatapp.company_admin":
      return "/dashboard";
    case "chatapp.support_agent":
      return "/inbox";
    default:
      return "/dashboard";
  }
}
