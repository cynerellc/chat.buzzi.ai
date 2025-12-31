import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse } from "next/server";

import { getRedisClient, isRedisConfigured } from "./client";

/**
 * Rate limiter configurations for different endpoints
 */
const rateLimiters = {
  /**
   * Widget message API - 60 requests per minute per session
   * Protects against chat spam from embedded widgets
   */
  widget: () =>
    new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(60, "1m"),
      prefix: "ratelimit:widget",
      analytics: false, // Disable analytics to save commands
    }),

  /**
   * Auth endpoints - 10 requests per minute per IP
   * Protects against brute force login attempts
   */
  auth: () =>
    new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(10, "1m"),
      prefix: "ratelimit:auth",
      analytics: false,
    }),

  /**
   * General API - 100 requests per minute per user/IP
   * General protection against API abuse
   */
  api: () =>
    new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(100, "1m"),
      prefix: "ratelimit:api",
      analytics: false,
    }),
} as const;

type RateLimiterType = keyof typeof rateLimiters;

// Cache rate limiter instances
const limiterCache = new Map<RateLimiterType, Ratelimit>();

function getLimiter(type: RateLimiterType): Ratelimit {
  if (!limiterCache.has(type)) {
    limiterCache.set(type, rateLimiters[type]());
  }
  return limiterCache.get(type)!;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for a given identifier and limiter type
 * Returns null if Redis is not configured (graceful degradation)
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimiterType
): Promise<RateLimitResult | null> {
  if (!isRedisConfigured()) {
    return null; // Graceful degradation - no rate limiting without Redis
  }

  try {
    const limiter = getLimiter(type);
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error(`Rate limit check failed for ${type}:`, error);
    return null; // Fail open - don't block requests if rate limiting fails
  }
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", result.limit.toString());
  headers.set("X-RateLimit-Remaining", result.remaining.toString());
  headers.set("X-RateLimit-Reset", result.reset.toString());
  return headers;
}

/**
 * Rate limit response (429 Too Many Requests)
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);

  return NextResponse.json(
    {
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": result.reset.toString(),
      },
    }
  );
}

/**
 * Rate limit middleware helper for API routes
 * Usage:
 *   const rateLimitResult = await withRateLimit(request, "widget", sessionId);
 *   if (rateLimitResult) return rateLimitResult; // Returns 429 if rate limited
 */
export async function withRateLimit(
  request: Request,
  type: RateLimiterType,
  identifier?: string
): Promise<NextResponse | null> {
  // Use provided identifier or fall back to IP
  const id =
    identifier ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous";

  const result = await checkRateLimit(id, type);

  // No rate limiting or allowed
  if (!result || result.success) {
    return null;
  }

  // Rate limited
  return rateLimitResponse(result);
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}
