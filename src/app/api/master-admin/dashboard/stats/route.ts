import { count, eq, sql, sum } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies, companySubscriptions, users } from "@/lib/db/schema";
import { cacheThrough } from "@/lib/redis/cache";
import { REDIS_KEYS, REDIS_TTL } from "@/lib/redis/client";

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

async function fetchDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Convert dates to ISO strings for the postgres driver
  const startOfMonthStr = startOfMonth.toISOString();
  const startOfLastMonthStr = startOfLastMonth.toISOString();

  // Run all queries in parallel for better performance
  const [
    totalCompaniesResult,
    companiesThisMonth,
    companiesLastMonth,
    activeCompaniesResult,
    activeCompaniesLastMonth,
    totalUsersResult,
    usersThisMonth,
    usersLastMonth,
    mrrResult,
  ] = await Promise.all([
    // Get total companies (not deleted)
    db
      .select({ count: count() })
      .from(companies)
      .where(sql`${companies.deletedAt} IS NULL`),
    // Get companies created this month
    db
      .select({ count: count() })
      .from(companies)
      .where(
        sql`${companies.deletedAt} IS NULL AND ${companies.createdAt} >= ${startOfMonthStr}::timestamp`
      ),
    // Get companies created last month
    db
      .select({ count: count() })
      .from(companies)
      .where(
        sql`${companies.deletedAt} IS NULL AND ${companies.createdAt} >= ${startOfLastMonthStr}::timestamp AND ${companies.createdAt} < ${startOfMonthStr}::timestamp`
      ),
    // Get active companies (with active subscription)
    db
      .select({ count: count() })
      .from(companies)
      .where(
        sql`${companies.deletedAt} IS NULL AND ${companies.status} = 'active'`
      ),
    // Get active companies last month
    db
      .select({ count: count() })
      .from(companySubscriptions)
      .where(
        sql`${companySubscriptions.status} = 'active' AND ${companySubscriptions.createdAt} < ${startOfMonthStr}::timestamp`
      ),
    // Get total users
    db
      .select({ count: count() })
      .from(users)
      .where(sql`${users.deletedAt} IS NULL`),
    // Get users created this month
    db
      .select({ count: count() })
      .from(users)
      .where(
        sql`${users.deletedAt} IS NULL AND ${users.createdAt} >= ${startOfMonthStr}::timestamp`
      ),
    // Get users last month at this point
    db
      .select({ count: count() })
      .from(users)
      .where(
        sql`${users.deletedAt} IS NULL AND ${users.createdAt} < ${startOfMonthStr}::timestamp`
      ),
    // Get MRR (monthly recurring revenue)
    db
      .select({ total: sum(companySubscriptions.currentPrice) })
      .from(companySubscriptions)
      .where(eq(companySubscriptions.status, "active")),
  ]);

  const monthlyRevenue = Number(mrrResult[0]?.total ?? 0);

  // Calculate growth percentages
  const calculateGrowth = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  return {
    totalCompanies: totalCompaniesResult[0]?.count ?? 0,
    totalCompaniesGrowth: calculateGrowth(
      companiesThisMonth[0]?.count ?? 0,
      companiesLastMonth[0]?.count ?? 0
    ),
    activeCompanies: activeCompaniesResult[0]?.count ?? 0,
    activeCompaniesGrowth: calculateGrowth(
      activeCompaniesResult[0]?.count ?? 0,
      activeCompaniesLastMonth[0]?.count ?? 0
    ),
    totalUsers: totalUsersResult[0]?.count ?? 0,
    totalUsersGrowth: calculateGrowth(
      usersThisMonth[0]?.count ?? 0,
      (usersLastMonth[0]?.count ?? 0) - (usersThisMonth[0]?.count ?? 0)
    ),
    monthlyRevenue,
    monthlyRevenueGrowth: 0, // Would need historical data
    messagesToday: 0, // Would come from analytics
    messagesTodayGrowth: 0,
  };
}

export async function GET() {
  try {
    await requireMasterAdmin();

    // Use cache-through pattern with 5 minute TTL
    const stats = await cacheThrough(
      REDIS_KEYS.DASHBOARD_MASTER_STATS,
      fetchDashboardStats,
      REDIS_TTL.DASHBOARD_STATS
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
