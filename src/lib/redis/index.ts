// Redis client and configuration
export {
  getRedisClient,
  isRedisConfigured,
  REDIS_KEYS,
  REDIS_TTL,
} from "./client";

// Caching utilities
export {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  cacheThrough,
  invalidateCompanyDashboardCache,
  invalidateMasterDashboardCache,
} from "./cache";

// Rate limiting
export {
  checkRateLimit,
  withRateLimit,
  rateLimitResponse,
  createRateLimitHeaders,
  getClientIP,
  type RateLimitResult,
} from "./rate-limit";

// Permission caching
export {
  getCachedCompanyPermission,
  invalidatePermissionCache,
  invalidateUserPermissionCache,
  invalidateCompanyPermissionCache,
} from "./permissions";

// Request deduplication
export {
  createDedupKey,
  withDeduplication,
  isDedupCached,
  type DedupResult,
} from "./dedup";
