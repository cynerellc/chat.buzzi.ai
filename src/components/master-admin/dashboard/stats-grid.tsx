"use client";

import { useMemo } from "react";
import { Building2, Users, MessageSquare, DollarSign } from "lucide-react";

import { StatCard } from "@/components/shared";
import { useDashboardStats } from "@/hooks/master-admin";

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export function StatsGrid() {
  const { stats, isLoading } = useDashboardStats();

  // M7: Memoize statCards array to prevent recreation on every render
  const statCards = useMemo(() => [
    {
      title: "Total Companies",
      value: stats ? formatNumber(stats.totalCompanies) : "0",
      change: stats?.totalCompaniesGrowth ?? 0,
      icon: Building2,
      iconColor: "text-primary",
      iconBgColor: "bg-primary/10",
    },
    {
      title: "Active Users",
      value: stats ? formatNumber(stats.totalUsers) : "0",
      change: stats?.totalUsersGrowth ?? 0,
      icon: Users,
      iconColor: "text-success",
      iconBgColor: "bg-success/10",
    },
    {
      title: "Messages Today",
      value: stats ? formatNumber(stats.messagesToday) : "0",
      change: stats?.messagesTodayGrowth ?? 0,
      icon: MessageSquare,
      iconColor: "text-secondary",
      iconBgColor: "bg-secondary/10",
    },
    {
      title: "Revenue (MTD)",
      value: stats ? formatCurrency(stats.monthlyRevenue) : "$0",
      change: stats?.monthlyRevenueGrowth ?? 0,
      icon: DollarSign,
      iconColor: "text-warning",
      iconBgColor: "bg-warning/10",
    },
  ], [stats]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <StatCard
          key={stat.title}
          title={stat.title}
          value={stat.value}
          change={stat.change}
          icon={stat.icon}
          iconColor={stat.iconColor}
          iconBgColor={stat.iconBgColor}
          changeLabel="from last month"
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
