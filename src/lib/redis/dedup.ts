import { getRedisClient, isRedisConfigured, REDIS_KEYS, REDIS_TTL } from "./client";

/**
 * Simple hash function for request deduplication keys
 */
function hashRequest(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Create a unique key for request deduplication
 * Combines endpoint, user identifier, and relevant parameters
 */
export function createDedupKey(
  endpoint: string,
  identifier: string,
  params?: Record<string, string | undefined>
): string {
  const parts = [endpoint, identifier];

  if (params) {
    const sortedParams = Object.entries(params)
      .filter(([_, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    if (sortedParams) {
      parts.push(sortedParams);
    }
  }

  return hashRequest(parts.join(":"));
}

export interface DedupResult<T> {
  cached: boolean;
  data: T;
}

/**
 * Execute a function with request deduplication
 * If the same request is already in-flight, waits and returns cached result
 *
 * @param key - Unique key for this request (use createDedupKey)
 * @param fn - Function to execute
 * @param ttlSeconds - How long to cache in-flight request (default: 5 seconds)
 */
export async function withDeduplication<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = REDIS_TTL.INFLIGHT_REQUEST
): Promise<DedupResult<T>> {
  if (!isRedisConfigured()) {
    // No Redis, just execute the function
    return { cached: false, data: await fn() };
  }

  const redis = getRedisClient();
  const cacheKey = REDIS_KEYS.inflight(key);

  try {
    // Try to get existing result
    const existing = await redis.get<{ data: T; status: "pending" | "complete" }>(cacheKey);

    if (existing) {
      if (existing.status === "complete") {
        return { cached: true, data: existing.data };
      }

      // Request is pending, wait and retry
      // Simple polling approach - in production you might use pub/sub
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const result = await redis.get<{ data: T; status: "pending" | "complete" }>(cacheKey);
        if (result?.status === "complete") {
          return { cached: true, data: result.data };
        }
      }

      // Timed out waiting, execute anyway
    }

    // Mark as pending
    await redis.set(cacheKey, { status: "pending" }, { ex: ttlSeconds });

    // Execute the function
    const data = await fn();

    // Store result
    await redis.set(cacheKey, { data, status: "complete" }, { ex: ttlSeconds });

    return { cached: false, data };
  } catch (error) {
    console.error(`Deduplication error for key ${key}:`, error);
    // On error, just execute the function
    return { cached: false, data: await fn() };
  }
}

/**
 * Check if a request with this key is already cached
 */
export async function isDedupCached(key: string): Promise<boolean> {
  if (!isRedisConfigured()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.inflight(key);
    const existing = await redis.get(cacheKey);
    return existing !== null;
  } catch {
    return false;
  }
}
