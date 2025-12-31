import { and, count, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies, companySubscriptions, subscriptionPlans } from "@/lib/db/schema";

export interface ChartDataPoint {
  date: string;
  companies: number;
  users: number;
  messages: number;
}

export interface PlanDistributionItem {
  name: string;
  value: number;
  color: string;
}

export async function GET(request: Request) {
  try {
    await requireMasterAdmin();

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") ?? "30");
    const type = searchParams.get("type") ?? "activity";

    if (type === "activity") {
      // Get company creation data over time
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const companyData = await db
        .select({
          date: sql<string>`DATE(${companies.createdAt})`,
          count: count(),
        })
        .from(companies)
        .where(
          and(
            sql`${companies.deletedAt} IS NULL`,
            gte(companies.createdAt, startDate)
          )
        )
        .groupBy(sql`DATE(${companies.createdAt})`)
        .orderBy(sql`DATE(${companies.createdAt})`);

      // Generate all dates in range with data
      const chartData: ChartDataPoint[] = [];
      const dataMap = new Map(
        companyData.map((d) => [d.date ?? "", d.count])
      );

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0] ?? "";
        chartData.push({
          date: dateStr,
          companies: dataMap.get(dateStr) ?? 0,
          users: 0, // Would come from user data
          messages: 0, // Would come from message data
        });
      }

      return NextResponse.json(chartData);
    }

    if (type === "distribution") {
      // Get plan distribution
      const planColors: Record<string, string> = {
        free: "#9CA3AF",
        starter: "#3B82F6",
        professional: "#8B5CF6",
        enterprise: "#F59E0B",
      };

      // Get all plans
      const plans = await db
        .select({
          id: subscriptionPlans.id,
          name: subscriptionPlans.name,
          slug: subscriptionPlans.slug,
        })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, true));

      // H3: Get all plan counts in parallel plus trial count
      const [planCounts, [trialCount]] = await Promise.all([
        // Get all plan subscription counts in parallel
        Promise.all(
          plans.map(async (plan) => {
            const [countResult] = await db
              .select({ count: count() })
              .from(companySubscriptions)
              .where(
                and(
                  eq(companySubscriptions.planId, plan.id),
                  eq(companySubscriptions.status, "active")
                )
              );
            return {
              name: plan.name,
              value: countResult?.count ?? 0,
              color: planColors[plan.slug.toLowerCase()] ?? "#6366F1",
            };
          })
        ),
        // Get trial companies count
        db
          .select({ count: count() })
          .from(companies)
          .where(
            and(
              sql`${companies.deletedAt} IS NULL`,
              eq(companies.status, "trial")
            )
          ),
      ]);

      const distribution: PlanDistributionItem[] = [...planCounts];

      if (trialCount && trialCount.count > 0) {
        distribution.push({
          name: "Trial",
          value: trialCount.count,
          color: "#22C55E",
        });
      }

      return NextResponse.json(distribution);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching chart data:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}
