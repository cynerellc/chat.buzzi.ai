/**
 * C3: React.cache() wrappers for request-level deduplication
 *
 * React's cache() function deduplicates identical function calls within a single
 * React Server Component render pass. This prevents multiple components from
 * hitting the database for the same data.
 *
 * Usage: Import these cached functions instead of the originals in Server Components.
 * Example: import { cachedRequireAuth } from "@/lib/data/cached-queries";
 */
import { cache } from "react";
import { eq, and, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies, chatbots, users, companyPermissions, knowledgeSources } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import type { CompanyPermissionRole } from "@/lib/auth/role-utils";

/**
 * Cached auth session check - deduplicates session verification
 */
export const cachedAuth = cache(async () => {
  return await auth();
});

/**
 * Cached company fetch by ID
 */
export const cachedGetCompanyById = cache(async (companyId: string) => {
  return await db.query.companies.findFirst({
    where: and(
      eq(companies.id, companyId),
      isNull(companies.deletedAt)
    ),
  });
});

/**
 * Cached chatbot fetch by ID
 */
export const cachedGetChatbotById = cache(async (chatbotId: string) => {
  return await db.query.chatbots.findFirst({
    where: and(
      eq(chatbots.id, chatbotId),
      isNull(chatbots.deletedAt)
    ),
  });
});

/**
 * Cached chatbot fetch by ID with company validation
 */
export const cachedGetChatbotByIdForCompany = cache(async (chatbotId: string, companyId: string) => {
  const [chatbot] = await db
    .select()
    .from(chatbots)
    .where(
      and(
        eq(chatbots.id, chatbotId),
        eq(chatbots.companyId, companyId),
        isNull(chatbots.deletedAt)
      )
    )
    .limit(1);
  return chatbot ?? null;
});

/**
 * Cached user fetch by ID
 */
export const cachedGetUserById = cache(async (userId: string) => {
  return await db.query.users.findFirst({
    where: and(
      eq(users.id, userId),
      isNull(users.deletedAt)
    ),
  });
});

/**
 * Cached company permission check
 */
export const cachedGetCompanyPermission = cache(async (userId: string, companyId: string): Promise<CompanyPermissionRole | null> => {
  const [permission] = await db
    .select({ role: companyPermissions.role })
    .from(companyPermissions)
    .where(
      and(
        eq(companyPermissions.userId, userId),
        eq(companyPermissions.companyId, companyId)
      )
    )
    .limit(1);
  return (permission?.role as CompanyPermissionRole) ?? null;
});

/**
 * Cached knowledge source fetch by ID
 */
export const cachedGetKnowledgeSourceById = cache(async (sourceId: string) => {
  return await db.query.knowledgeSources.findFirst({
    where: and(
      eq(knowledgeSources.id, sourceId),
      isNull(knowledgeSources.deletedAt)
    ),
  });
});

/**
 * Cached knowledge source fetch by ID with company validation
 */
export const cachedGetKnowledgeSourceByIdForCompany = cache(async (sourceId: string, companyId: string) => {
  const [source] = await db
    .select()
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.companyId, companyId),
        isNull(knowledgeSources.deletedAt)
      )
    )
    .limit(1);
  return source ?? null;
});

/**
 * Cached company list for user (based on permissions)
 */
export const cachedGetUserCompanies = cache(async (userId: string) => {
  return await db.query.companyPermissions.findMany({
    where: eq(companyPermissions.userId, userId),
    with: {
      company: true,
    },
  });
});
