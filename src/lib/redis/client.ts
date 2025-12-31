import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

/**
 * Get Upstash Redis client (HTTP-based, serverless compatible)
 * Uses singleton pattern to reuse connections
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        "Redis environment variables not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
      );
    }

    redisClient = new Redis({
      url,
      token,
    });
  }

  return redisClient;
}

/**
 * Check if Redis is configured (for optional Redis features)
 */
export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/**
 * Redis key prefixes for different features
 */
export const REDIS_KEYS = {
  // Dashboard stats cache
  DASHBOARD_MASTER_STATS: "dashboard:master:stats",
  dashboardCompanyStats: (companyId: string) =>
    `dashboard:company:${companyId}:stats`,

  // Rate limiting
  rateLimit: (identifier: string, endpoint: string) =>
    `ratelimit:${identifier}:${endpoint}`,

  // Permission cache
  permissions: (userId: string, companyId: string) =>
    `permissions:${userId}:${companyId}`,

  // Request deduplication
  inflight: (hash: string) => `inflight:${hash}`,

  // Session store
  session: (token: string) => `session:${token}`,
} as const;

/**
 * Default TTL values in seconds
 */
export const REDIS_TTL = {
  DASHBOARD_STATS: 5 * 60, // 5 minutes
  PERMISSIONS: 15 * 60, // 15 minutes
  SESSION: 30 * 24 * 60 * 60, // 30 days
  INFLIGHT_REQUEST: 5, // 5 seconds
} as const;
