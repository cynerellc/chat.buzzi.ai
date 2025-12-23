"use client";

import { CreditCard } from "lucide-react";

import type { PlanListItem } from "@/hooks/master-admin";
import { Card, Skeleton } from "@/components/ui";
import { PlanCard } from "./plan-card";

interface PlansGridProps {
  plans: PlanListItem[];
  isLoading: boolean;
  onEdit: (plan: PlanListItem) => void;
}

export function PlansGrid({ plans, isLoading, onEdit }: PlansGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-6 w-24 mb-2" />
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-8 w-20 mb-6" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <Card className="p-12 text-center">
        <CreditCard size={48} className="mx-auto mb-4 text-default-300" />
        <h3 className="font-semibold mb-2">No Plans Found</h3>
        <p className="text-default-500">
          Create your first subscription plan to get started.
        </p>
      </Card>
    );
  }

  // Find the most popular plan (highest company count)
  const popularPlanId = plans.reduce(
    (maxId, plan) =>
      plan.companiesCount > (plans.find((p) => p.id === maxId)?.companiesCount ?? 0)
        ? plan.id
        : maxId,
    plans[0]?.id
  );

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          onEdit={onEdit}
          isPopular={plan.id === popularPlanId && plan.companiesCount > 0}
        />
      ))}
    </div>
  );
}
