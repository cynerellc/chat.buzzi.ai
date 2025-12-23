import { headers } from "next/headers";

import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export interface CreateAuditLogParams {
  userId?: string | null;
  userEmail?: string | null;
  companyId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    // Try to get IP and user agent from headers if not provided
    let ipAddress = params.ipAddress;
    let userAgent = params.userAgent;

    if (!ipAddress || !userAgent) {
      try {
        const headersList = await headers();
        if (!ipAddress) {
          ipAddress = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
            ?? headersList.get("x-real-ip")
            ?? null;
        }
        if (!userAgent) {
          userAgent = headersList.get("user-agent") ?? null;
        }
      } catch {
        // Headers may not be available in all contexts
      }
    }

    await db.insert(auditLogs).values({
      userId: params.userId ?? null,
      userEmail: params.userEmail ?? null,
      companyId: params.companyId ?? null,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId ?? null,
      details: params.details ?? {},
      oldValues: params.oldValues ?? null,
      newValues: params.newValues ?? null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });
  } catch (error) {
    // Log the error but don't throw - audit logging should not break the main flow
    console.error("Failed to create audit log:", error);
  }
}

// Action type constants for consistency
export const AUDIT_ACTIONS = {
  // Company actions
  COMPANY_CREATED: "company.created",
  COMPANY_UPDATED: "company.updated",
  COMPANY_DELETED: "company.deleted",
  COMPANY_SUSPENDED: "company.suspended",
  COMPANY_ACTIVATED: "company.activated",

  // User actions
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
  USER_IMPERSONATED: "user.impersonated",
  USER_ROLE_CHANGED: "user.role_changed",
  USER_INVITED: "user.invited",

  // Agent actions
  AGENT_CREATED: "agent.created",
  AGENT_UPDATED: "agent.updated",
  AGENT_DELETED: "agent.deleted",
  AGENT_ACTIVATED: "agent.activated",
  AGENT_DEACTIVATED: "agent.deactivated",

  // Plan actions
  PLAN_CREATED: "plan.created",
  PLAN_UPDATED: "plan.updated",
  PLAN_DELETED: "plan.deleted",

  // Package actions
  PACKAGE_CREATED: "package.created",
  PACKAGE_UPDATED: "package.updated",
  PACKAGE_DELETED: "package.deleted",

  // Subscription actions
  SUBSCRIPTION_CREATED: "subscription.created",
  SUBSCRIPTION_CHANGED: "subscription.changed",
  SUBSCRIPTION_RENEWED: "subscription.renewed",
  SUBSCRIPTION_CANCELLED: "subscription.cancelled",

  // Settings actions
  SETTINGS_UPDATED: "settings.updated",

  // Auth actions
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_PASSWORD_RESET: "auth.password_reset",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// Resource type constants
export const AUDIT_RESOURCES = {
  COMPANY: "company",
  USER: "user",
  AGENT: "agent",
  PLAN: "plan",
  PACKAGE: "package",
  SUBSCRIPTION: "subscription",
  SETTINGS: "settings",
  AUTH: "auth",
} as const;

export type AuditResource = (typeof AUDIT_RESOURCES)[keyof typeof AUDIT_RESOURCES];

/**
 * Helper to compute the diff between old and new values
 */
export function computeDiff(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const changedOld: Record<string, unknown> = {};
  const changedNew: Record<string, unknown> = {};

  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    const oldVal = oldValues[key];
    const newVal = newValues[key];

    // Skip if both are undefined
    if (oldVal === undefined && newVal === undefined) continue;

    // Check if values are different
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changedOld[key] = oldVal;
      changedNew[key] = newVal;
    }
  }

  return { oldValues: changedOld, newValues: changedNew };
}
