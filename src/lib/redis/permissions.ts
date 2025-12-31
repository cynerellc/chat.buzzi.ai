import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { companyPermissions } from "@/lib/db/schema";
import type { CompanyPermissionRole } from "@/lib/auth/role-utils";

import { cacheGet, cacheSet, cacheDelete } from "./cache";
import { REDIS_KEYS, REDIS_TTL, isRedisConfigured } from "./client";

/**
 * Get cached permission for a user in a company
 * Falls back to database query if not in cache
 */
export async function getCachedCompanyPermission(
  userId: string,
  companyId: string
): Promise<CompanyPermissionRole | null> {
  const cacheKey = REDIS_KEYS.permissions(userId, companyId);

  // Try cache first
  if (isRedisConfigured()) {
    const cached = await cacheGet<CompanyPermissionRole | "none">(cacheKey);
    if (cached !== null) {
      return cached === "none" ? null : cached;
    }
  }

  // Query database
  const permission = await db.query.companyPermissions.findFirst({
    where: and(
      eq(companyPermissions.userId, userId),
      eq(companyPermissions.companyId, companyId)
    ),
  });

  const role = (permission?.role as CompanyPermissionRole) ?? null;

  // Cache result (store "none" for null to differentiate from cache miss)
  if (isRedisConfigured()) {
    await cacheSet(cacheKey, role ?? "none", REDIS_TTL.PERMISSIONS);
  }

  return role;
}

/**
 * Invalidate permission cache for a user in a company
 * Call this when permissions change
 */
export async function invalidatePermissionCache(
  userId: string,
  companyId: string
): Promise<void> {
  const cacheKey = REDIS_KEYS.permissions(userId, companyId);
  await cacheDelete(cacheKey);
}

/**
 * Invalidate all permission caches for a user
 * Call this when user is removed from all companies
 */
export async function invalidateUserPermissionCache(
  userId: string
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  const { cacheDeletePattern } = await import("./cache");
  await cacheDeletePattern(`permissions:${userId}:*`);
}

/**
 * Invalidate all permission caches for a company
 * Call this when company permissions are bulk updated
 */
export async function invalidateCompanyPermissionCache(
  companyId: string
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  const { cacheDeletePattern } = await import("./cache");
  await cacheDeletePattern(`permissions:*:${companyId}`);
}
