import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  companies,
  companyPermissions,
  companySubscriptions,
  subscriptionPlans,
  users,
  type Company,
  type CompanySubscription,
  type SubscriptionPlan,
} from "@/lib/db/schema";
import type { CompanyPermissionRole } from "./role-utils";

import { auth } from "./index";

// Cookie name for storing the active company ID
export const ACTIVE_COMPANY_COOKIE = "active_company_id";

export interface CompanyContext {
  company: Company;
  permissionRole: CompanyPermissionRole;
  subscription: CompanySubscription | null;
  plan: SubscriptionPlan | null;
  limits: {
    maxAgents: number;
    maxConversationsPerMonth: number;
    maxKnowledgeSources: number;
    maxStorageGb: number;
    maxTeamMembers: number;
  };
  features: {
    customBranding: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
    advancedAnalytics: boolean;
    customIntegrations: boolean;
  };
}

/**
 * Get the active company ID from cookie
 */
export async function getActiveCompanyId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
}

/**
 * Set the active company ID in cookie and database
 * This should be called from a Server Action or API route
 */
export async function setActiveCompanyId(companyId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  // Also persist to database for login redirect
  const session = await auth();
  if (session?.user?.id) {
    await db
      .update(users)
      .set({ activeCompanyId: companyId, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
  }
}

/**
 * Clear the active company cookie and database
 */
export async function clearActiveCompany(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_COMPANY_COOKIE);

  // Also clear from database
  const session = await auth();
  if (session?.user?.id) {
    await db
      .update(users)
      .set({ activeCompanyId: null, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
  }
}

/**
 * Get the current user's active company
 * Returns null if no company is selected or user doesn't have access
 */
export async function getCurrentCompany(): Promise<{
  company: Company;
  permissionRole: CompanyPermissionRole;
} | null> {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  const companyId = await getActiveCompanyId();

  if (!companyId) {
    return null;
  }

  // Get company
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  if (!company) {
    return null;
  }

  // Master admins have access to all companies
  if (session.user.role === "chatapp.master_admin") {
    return {
      company,
      permissionRole: "chatapp.company_admin", // Master admins get company_admin rights
    };
  }

  // Check if user has permission for this company
  const permission = await db.query.companyPermissions.findFirst({
    where: and(
      eq(companyPermissions.userId, session.user.id),
      eq(companyPermissions.companyId, companyId)
    ),
  });

  if (!permission) {
    // User doesn't have access to this company, clear the cookie
    await clearActiveCompany();
    return null;
  }

  return {
    company,
    permissionRole: permission.role as CompanyPermissionRole,
  };
}

/**
 * Get the current user's role in the active company
 */
export async function getCurrentCompanyRole(): Promise<CompanyPermissionRole | null> {
  const result = await getCurrentCompany();
  return result?.permissionRole ?? null;
}

/**
 * Get company by ID
 */
export async function getCompanyById(companyId: string): Promise<Company | null> {
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  return company ?? null;
}

/**
 * Get company by slug
 */
export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  const company = await db.query.companies.findFirst({
    where: eq(companies.slug, slug),
  });

  return company ?? null;
}

/**
 * Validate company access for current user
 */
export async function validateCompanyAccess(companyId: string): Promise<boolean> {
  const session = await auth();

  if (!session?.user) {
    return false;
  }

  // Master admins have access to all companies
  if (session.user.role === "chatapp.master_admin") {
    return true;
  }

  // Check company_permissions table
  const permission = await db.query.companyPermissions.findFirst({
    where: and(
      eq(companyPermissions.userId, session.user.id),
      eq(companyPermissions.companyId, companyId)
    ),
  });

  return !!permission;
}

/**
 * Get full company context including subscription and limits
 */
export async function getCompanyContext(): Promise<CompanyContext | null> {
  const result = await getCurrentCompany();

  if (!result) {
    return null;
  }

  const { company, permissionRole } = result;

  // Get active subscription
  const subscription = await db.query.companySubscriptions.findFirst({
    where: eq(companySubscriptions.companyId, company.id),
    orderBy: (cs, { desc }) => [desc(cs.createdAt)],
  });

  // Get subscription plan
  let plan: SubscriptionPlan | null = null;
  if (subscription) {
    const foundPlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, subscription.planId),
    });
    plan = foundPlan ?? null;
  }

  // Default limits for free/trial
  const defaultLimits = {
    maxAgents: 1,
    maxConversationsPerMonth: 100,
    maxKnowledgeSources: 3,
    maxStorageGb: 1,
    maxTeamMembers: 1,
  };

  const defaultFeatures = {
    customBranding: false,
    prioritySupport: false,
    apiAccess: false,
    advancedAnalytics: false,
    customIntegrations: false,
  };

  return {
    company,
    permissionRole,
    subscription: subscription ?? null,
    plan,
    limits: plan
      ? {
          maxAgents: plan.maxAgents,
          maxConversationsPerMonth: plan.maxConversationsPerMonth,
          maxKnowledgeSources: plan.maxKnowledgeSources,
          maxStorageGb: plan.maxStorageGb,
          maxTeamMembers: plan.maxTeamMembers,
        }
      : defaultLimits,
    features: plan
      ? {
          customBranding: plan.customBranding,
          prioritySupport: plan.prioritySupport,
          apiAccess: plan.apiAccess,
          advancedAnalytics: plan.advancedAnalytics,
          customIntegrations: plan.customIntegrations,
        }
      : defaultFeatures,
  };
}

/**
 * Get company context by ID (for API routes that receive companyId)
 */
export async function getCompanyContextById(
  companyId: string
): Promise<Omit<CompanyContext, "permissionRole"> | null> {
  const company = await getCompanyById(companyId);

  if (!company) {
    return null;
  }

  // Get active subscription
  const subscription = await db.query.companySubscriptions.findFirst({
    where: eq(companySubscriptions.companyId, company.id),
    orderBy: (cs, { desc }) => [desc(cs.createdAt)],
  });

  // Get subscription plan
  let plan: SubscriptionPlan | null = null;
  if (subscription) {
    const foundPlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, subscription.planId),
    });
    plan = foundPlan ?? null;
  }

  // Default limits for free/trial
  const defaultLimits = {
    maxAgents: 1,
    maxConversationsPerMonth: 100,
    maxKnowledgeSources: 3,
    maxStorageGb: 1,
    maxTeamMembers: 1,
  };

  const defaultFeatures = {
    customBranding: false,
    prioritySupport: false,
    apiAccess: false,
    advancedAnalytics: false,
    customIntegrations: false,
  };

  return {
    company,
    subscription: subscription ?? null,
    plan,
    limits: plan
      ? {
          maxAgents: plan.maxAgents,
          maxConversationsPerMonth: plan.maxConversationsPerMonth,
          maxKnowledgeSources: plan.maxKnowledgeSources,
          maxStorageGb: plan.maxStorageGb,
          maxTeamMembers: plan.maxTeamMembers,
        }
      : defaultLimits,
    features: plan
      ? {
          customBranding: plan.customBranding,
          prioritySupport: plan.prioritySupport,
          apiAccess: plan.apiAccess,
          advancedAnalytics: plan.advancedAnalytics,
          customIntegrations: plan.customIntegrations,
        }
      : defaultFeatures,
  };
}

/**
 * Check if company has access to a specific feature
 */
export async function hasFeature(
  feature: keyof CompanyContext["features"]
): Promise<boolean> {
  const context = await getCompanyContext();

  if (!context) {
    return false;
  }

  return context.features[feature];
}

/**
 * Check if company is within a specific limit
 */
export async function isWithinLimit(
  limit: keyof CompanyContext["limits"],
  currentUsage: number
): Promise<boolean> {
  const context = await getCompanyContext();

  if (!context) {
    return false;
  }

  return currentUsage < context.limits[limit];
}
