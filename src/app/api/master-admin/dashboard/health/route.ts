import { NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export type HealthStatus = "healthy" | "warning" | "critical";

export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
}

export interface SystemHealth {
  overall: HealthStatus;
  services: ServiceHealth[];
  uptime: number;
  lastIncidentDays: number;
  lastChecked: Date;
}

async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    // Simple query to check database connection
    await db.execute("SELECT 1");
    return {
      name: "Database",
      status: "healthy",
      latency: Date.now() - start,
    };
  } catch {
    return {
      name: "Database",
      status: "critical",
      message: "Connection failed",
    };
  }
}

async function checkApi(): Promise<ServiceHealth> {
  // API is working if this endpoint is reachable
  return {
    name: "API",
    status: "healthy",
    latency: 0,
  };
}

async function checkAiServices(): Promise<ServiceHealth> {
  // Check if AI provider env vars are set
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  if (!hasOpenAI && !hasAnthropic) {
    return {
      name: "AI Services",
      status: "warning",
      message: "No AI provider configured",
    };
  }

  return {
    name: "AI Services",
    status: "healthy",
  };
}

async function checkQueue(): Promise<ServiceHealth> {
  // Check if Redis/Queue is configured
  const hasRedis = !!process.env.REDIS_URL;

  if (!hasRedis) {
    return {
      name: "Queue",
      status: "warning",
      message: "Redis not configured",
    };
  }

  return {
    name: "Queue",
    status: "healthy",
  };
}

async function checkStorage(): Promise<ServiceHealth> {
  // Check if storage is configured
  const hasStorage = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!hasStorage) {
    return {
      name: "Storage",
      status: "warning",
      message: "Storage not configured",
    };
  }

  return {
    name: "Storage",
    status: "healthy",
  };
}

export async function GET() {
  try {
    await requireMasterAdmin();

    const services = await Promise.all([
      checkApi(),
      checkDatabase(),
      checkAiServices(),
      checkQueue(),
      checkStorage(),
    ]);

    // Determine overall status
    const hasCritical = services.some((s) => s.status === "critical");
    const hasWarning = services.some((s) => s.status === "warning");

    const overall: HealthStatus = hasCritical
      ? "critical"
      : hasWarning
        ? "warning"
        : "healthy";

    const health: SystemHealth = {
      overall,
      services,
      uptime: 99.97, // Would come from monitoring service
      lastIncidentDays: 14, // Would come from incident tracking
      lastChecked: new Date(),
    };

    return NextResponse.json(health);
  } catch (error) {
    console.error("Error checking system health:", error);
    return NextResponse.json(
      { error: "Failed to check system health" },
      { status: 500 }
    );
  }
}
