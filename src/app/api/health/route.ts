/**
 * Public Health Check API
 *
 * GET /api/health - Basic health check for load balancers and monitoring
 *
 * This endpoint is intentionally unauthenticated to allow infrastructure
 * health checks (load balancers, Kubernetes probes, monitoring systems).
 *
 * Response format:
 * - 200 OK: Service is healthy
 * - 503 Service Unavailable: Service is unhealthy
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface HealthCheckResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: {
      status: "up" | "down";
      latencyMs?: number;
      error?: string;
    };
  };
}

// Get version from package.json or env
const APP_VERSION = process.env.APP_VERSION || process.env.npm_package_version || "1.0.0";

async function checkDatabase(): Promise<{
  status: "up" | "down";
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return {
      status: "up",
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "down",
      error: error instanceof Error ? error.message : "Database connection failed",
    };
  }
}

export async function GET() {
  const timestamp = new Date().toISOString();

  // Run health checks
  const databaseCheck = await checkDatabase();

  // Determine overall health
  const isHealthy = databaseCheck.status === "up";

  const response: HealthCheckResponse = {
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp,
    version: APP_VERSION,
    checks: {
      database: databaseCheck,
    },
  };

  // Return appropriate HTTP status code
  // 503 allows load balancers to know the service is not ready
  return NextResponse.json(response, {
    status: isHealthy ? 200 : 503,
    headers: {
      // Prevent caching of health check responses
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

// Support HEAD requests for lightweight health checks
export async function HEAD() {
  const databaseCheck = await checkDatabase();
  const isHealthy = databaseCheck.status === "up";

  return new NextResponse(null, {
    status: isHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
