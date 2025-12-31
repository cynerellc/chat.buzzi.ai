import { getRedisClient, isRedisConfigured, REDIS_TTL } from "./client";

/**
 * Generic cache wrapper for Redis operations
 * Provides graceful degradation when Redis is not configured
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    const redis = getRedisClient();
    const data = await redis.get<T>(key);
    return data;
  } catch (error) {
    console.error(`Cache get error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set a value in cache with optional TTL
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<boolean> {
  if (!isRedisConfigured()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    if (ttlSeconds) {
      await redis.set(key, value, { ex: ttlSeconds });
    } else {
      await redis.set(key, value);
    }
    return true;
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete a key from cache
 */
export async function cacheDelete(key: string): Promise<boolean> {
  if (!isRedisConfigured()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    await redis.del(key);
    return true;
  } catch (error) {
    console.error(`Cache delete error for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete multiple keys matching a pattern
 * Note: Use sparingly as KEYS command can be slow on large datasets
 */
export async function cacheDeletePattern(pattern: string): Promise<boolean> {
  if (!isRedisConfigured()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return true;
  } catch (error) {
    console.error(`Cache delete pattern error for ${pattern}:`, error);
    return false;
  }
}

/**
 * Cache-through helper: Get from cache or execute function and cache result
 */
export async function cacheThrough<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = REDIS_TTL.DASHBOARD_STATS
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Execute function and cache result
  const result = await fn();
  await cacheSet(key, result, ttlSeconds);
  return result;
}

/**
 * Invalidate dashboard stats cache for a company
 */
export async function invalidateCompanyDashboardCache(
  companyId: string
): Promise<void> {
  const { REDIS_KEYS } = await import("./client");
  await cacheDelete(REDIS_KEYS.dashboardCompanyStats(companyId));
}

/**
 * Invalidate master admin dashboard stats cache
 */
export async function invalidateMasterDashboardCache(): Promise<void> {
  const { REDIS_KEYS } = await import("./client");
  await cacheDelete(REDIS_KEYS.DASHBOARD_MASTER_STATS);
}
