import { and, count, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies, companyPermissions, companySubscriptions, subscriptionPlans, users } from "@/lib/db/schema";

export interface RecentCompany {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  status: string;
  planName: string | null;
  userCount: number;
  createdAt: Date;
}

export async function GET(request: Request) {
  try {
    await requireMasterAdmin();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "5"), 20);

    // Get recent companies with subscription info
    const recentCompanies = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        logoUrl: companies.logoUrl,
        status: companies.status,
        createdAt: companies.createdAt,
      })
      .from(companies)
      .where(sql`${companies.deletedAt} IS NULL`)
      .orderBy(desc(companies.createdAt))
      .limit(limit);

    // Enrich with subscription and user count data
    const enrichedCompanies: RecentCompany[] = await Promise.all(
      recentCompanies.map(async (company) => {
        // Get subscription plan name
        const [subscription] = await db
          .select({
            planName: subscriptionPlans.name,
          })
          .from(companySubscriptions)
          .innerJoin(
            subscriptionPlans,
            eq(companySubscriptions.planId, subscriptionPlans.id)
          )
          .where(eq(companySubscriptions.companyId, company.id))
          .limit(1);

        // Get user count via company_permissions
        const [userCount] = await db
          .select({ count: count() })
          .from(companyPermissions)
          .innerJoin(users, eq(companyPermissions.userId, users.id))
          .where(
            and(
              eq(companyPermissions.companyId, company.id),
              sql`${users.deletedAt} IS NULL`
            )
          );

        return {
          ...company,
          planName: subscription?.planName ?? null,
          userCount: userCount?.count ?? 0,
        };
      })
    );

    return NextResponse.json(enrichedCompanies);
  } catch (error) {
    console.error("Error fetching recent companies:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent companies" },
      { status: 500 }
    );
  }
}
