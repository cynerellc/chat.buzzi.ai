import { and, count, eq, gte, sql, sum } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies, companySubscriptions, users } from "@/lib/db/schema";

export interface DashboardStats {
  totalCompanies: number;
  totalCompaniesGrowth: number;
  activeCompanies: number;
  activeCompaniesGrowth: number;
  totalUsers: number;
  totalUsersGrowth: number;
  monthlyRevenue: number;
  monthlyRevenueGrowth: number;
  messagesToday: number;
  messagesTodayGrowth: number;
}

export async function GET() {
  try {
    await requireMasterAdmin();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Get total companies (not deleted)
    const [totalCompaniesResult] = await db
      .select({ count: count() })
      .from(companies)
      .where(sql`${companies.deletedAt} IS NULL`);

    // Get companies created this month
    const [companiesThisMonth] = await db
      .select({ count: count() })
      .from(companies)
      .where(
        and(
          sql`${companies.deletedAt} IS NULL`,
          gte(companies.createdAt, startOfMonth)
        )
      );

    // Get companies created last month
    const [companiesLastMonth] = await db
      .select({ count: count() })
      .from(companies)
      .where(
        and(
          sql`${companies.deletedAt} IS NULL`,
          gte(companies.createdAt, startOfLastMonth),
          sql`${companies.createdAt} < ${startOfMonth}`
        )
      );

    // Get active companies (with active subscription)
    const [activeCompaniesResult] = await db
      .select({ count: count() })
      .from(companies)
      .where(
        and(
          sql`${companies.deletedAt} IS NULL`,
          eq(companies.status, "active")
        )
      );

    // Get active companies last month
    const [activeCompaniesLastMonth] = await db
      .select({ count: count() })
      .from(companySubscriptions)
      .where(
        and(
          eq(companySubscriptions.status, "active"),
          sql`${companySubscriptions.createdAt} < ${startOfMonth}`
        )
      );

    // Get total users
    const [totalUsersResult] = await db
      .select({ count: count() })
      .from(users)
      .where(sql`${users.deletedAt} IS NULL`);

    // Get users created this month
    const [usersThisMonth] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          sql`${users.deletedAt} IS NULL`,
          gte(users.createdAt, startOfMonth)
        )
      );

    // Get users last month at this point
    const [usersLastMonth] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          sql`${users.deletedAt} IS NULL`,
          sql`${users.createdAt} < ${startOfMonth}`
        )
      );

    // Get MRR (monthly recurring revenue)
    const [mrrResult] = await db
      .select({ total: sum(companySubscriptions.currentPrice) })
      .from(companySubscriptions)
      .where(eq(companySubscriptions.status, "active"));

    const monthlyRevenue = Number(mrrResult?.total ?? 0);

    // Calculate growth percentages
    const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const stats: DashboardStats = {
      totalCompanies: totalCompaniesResult?.count ?? 0,
      totalCompaniesGrowth: calculateGrowth(
        companiesThisMonth?.count ?? 0,
        companiesLastMonth?.count ?? 0
      ),
      activeCompanies: activeCompaniesResult?.count ?? 0,
      activeCompaniesGrowth: calculateGrowth(
        activeCompaniesResult?.count ?? 0,
        activeCompaniesLastMonth?.count ?? 0
      ),
      totalUsers: totalUsersResult?.count ?? 0,
      totalUsersGrowth: calculateGrowth(
        usersThisMonth?.count ?? 0,
        (usersLastMonth?.count ?? 0) - (usersThisMonth?.count ?? 0)
      ),
      monthlyRevenue,
      monthlyRevenueGrowth: 0, // Would need historical data
      messagesToday: 0, // Would come from analytics
      messagesTodayGrowth: 0,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
