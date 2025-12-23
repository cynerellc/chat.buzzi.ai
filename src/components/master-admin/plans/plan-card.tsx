"use client";

import {
  Check,
  Crown,
  Database,
  MessageSquare,
  Pencil,
  Users,
  X,
  Zap,
} from "lucide-react";

import type { PlanListItem } from "@/hooks/master-admin";
import { Badge, Button, Card, type BadgeVariant } from "@/components/ui";

interface PlanCardProps {
  plan: PlanListItem;
  onEdit: (plan: PlanListItem) => void;
  isPopular?: boolean;
}

export function PlanCard({ plan, onEdit, isPopular }: PlanCardProps) {
  const statusVariant: BadgeVariant = plan.isActive ? "success" : "default";

  return (
    <Card className="p-6 relative flex flex-col h-full">
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge variant="warning" size="sm" className="flex items-center gap-1">
            <Crown size={12} />
            Popular
          </Badge>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          {plan.description && (
            <p className="text-sm text-default-500 mt-1">{plan.description}</p>
          )}
        </div>
        <Badge variant={statusVariant} size="sm">
          {plan.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">
            ${parseFloat(plan.basePrice).toFixed(0)}
          </span>
          <span className="text-default-500">/month</span>
        </div>
        {plan.trialDays > 0 && (
          <p className="text-xs text-default-400 mt-1">
            {plan.trialDays} day free trial
          </p>
        )}
      </div>

      <div className="space-y-3 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <Zap size={16} className="text-primary" />
          <span>{plan.maxAgents} Agents</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MessageSquare size={16} className="text-primary" />
          <span>{plan.maxConversationsPerMonth.toLocaleString()} Messages/mo</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users size={16} className="text-primary" />
          <span>{plan.maxTeamMembers} Team Members</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Database size={16} className="text-primary" />
          <span>{plan.maxStorageGb} GB Storage</span>
        </div>

        <div className="pt-3 border-t border-divider space-y-2">
          <FeatureItem enabled={plan.customBranding} label="Custom Branding" />
          <FeatureItem enabled={plan.prioritySupport} label="Priority Support" />
          <FeatureItem enabled={plan.apiAccess} label="API Access" />
          <FeatureItem enabled={plan.advancedAnalytics} label="Advanced Analytics" />
          <FeatureItem enabled={plan.customIntegrations} label="Custom Integrations" />
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-divider">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-default-500">
            {plan.companiesCount} {plan.companiesCount === 1 ? "company" : "companies"}
          </span>
        </div>
        <Button
          variant="flat"
          className="w-full"
          startContent={<Pencil size={16} />}
          onPress={() => onEdit(plan)}
        >
          Edit Plan
        </Button>
      </div>
    </Card>
  );
}

function FeatureItem({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {enabled ? (
        <Check size={14} className="text-success" />
      ) : (
        <X size={14} className="text-default-300" />
      )}
      <span className={enabled ? "" : "text-default-400"}>{label}</span>
    </div>
  );
}
