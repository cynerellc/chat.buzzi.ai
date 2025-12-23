import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  companies,
  companySubscriptions,
  subscriptionPlans,
  type Company,
  type CompanySubscription,
  type SubscriptionPlan,
} from "@/lib/db/schema";

import { auth } from "./index";

export interface CompanyContext {
  company: Company;
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
 * Get the current user's company
 */
export async function getCurrentCompany(): Promise<Company | null> {
  const session = await auth();

  if (!session?.user?.companyId) {
    return null;
  }

  const company = await db.query.companies.findFirst({
    where: eq(companies.id, session.user.companyId),
  });

  return company ?? null;
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
  if (session.user.role === "master_admin") {
    return true;
  }

  return session.user.companyId === companyId;
}

/**
 * Get full company context including subscription and limits
 */
export async function getCompanyContext(): Promise<CompanyContext | null> {
  const company = await getCurrentCompany();

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
