"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronRight, Building2 } from "lucide-react";
import Link from "next/link";

import { Badge, Card, Skeleton, UserAvatar, type BadgeVariant } from "@/components/ui";
import { useRecentCompanies } from "@/hooks/master-admin";

const planBadgeColors: Record<string, BadgeVariant> = {
  starter: "default",
  professional: "info",
  pro: "info",
  enterprise: "success",
  trial: "warning",
};

export function RecentCompanies() {
  const { companies, isLoading } = useRecentCompanies(5);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Recent Companies</h3>
          <p className="text-sm text-default-500">Latest signups</p>
        </div>
        <Link
          href="/admin/companies"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          View All
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2"
            >
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))
        ) : companies.length === 0 ? (
          <div className="text-center py-8 text-default-400">
            <Building2 size={32} className="mx-auto mb-2 opacity-50" />
            <p>No companies yet</p>
          </div>
        ) : (
          companies.map((company) => (
            <Link
              key={company.id}
              href={`/admin/companies/${company.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-default-100 transition-colors group"
            >
              <UserAvatar
                name={company.name}
                src={company.logoUrl ?? undefined}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate group-hover:text-primary transition-colors">
                  {company.name}
                </p>
                <p className="text-xs text-default-400">
                  {formatDistanceToNow(new Date(company.createdAt), {
                    addSuffix: true,
                  })}
                  {company.userCount > 0 && (
                    <span> · {company.userCount} users</span>
                  )}
                </p>
              </div>
              {company.planName ? (
                <Badge
                  variant={planBadgeColors[company.planName.toLowerCase()] ?? "default"}
                  size="sm"
                >
                  {company.planName}
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  Trial
                </Badge>
              )}
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
