"use client";

import { motion } from "framer-motion";
import {
  Check,
  Crown,
  Database,
  MessageSquare,
  Pencil,
  Users,
  X,
  Zap,
  Building2,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { PlanListItem } from "@/hooks/master-admin";
import { Button, Card } from "@/components/ui";

interface PlanCardProps {
  plan: PlanListItem;
  onEdit: (plan: PlanListItem) => void;
  isPopular?: boolean;
}

export function PlanCard({ plan, onEdit, isPopular }: PlanCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "group p-6 relative flex flex-col h-full transition-all duration-300",
        "hover:shadow-xl hover:shadow-primary/5",
        isPopular && "border-primary/50 shadow-lg shadow-primary/10"
      )}>
        {isPopular && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium shadow-lg">
              <Crown size={12} />
              Most Popular
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{plan.name}</h3>
            {plan.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>
            )}
          </div>
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
            plan.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", plan.isActive ? "bg-success animate-pulse" : "bg-muted-foreground")} />
            {plan.isActive ? "Active" : "Inactive"}
          </div>
        </div>

        <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight">
              ${parseFloat(plan.basePrice).toFixed(0)}
            </span>
            <span className="text-muted-foreground">/month</span>
          </div>
          {plan.trialDays > 0 && (
            <p className="text-xs text-primary mt-2 flex items-center gap-1">
              <Sparkles size={12} />
              {plan.trialDays} day free trial included
            </p>
          )}
        </div>

        <div className="space-y-3 flex-1">
          <LimitItem icon={Zap} value={plan.maxAgents} label="Agents" />
          <LimitItem icon={MessageSquare} value={plan.maxConversationsPerMonth.toLocaleString()} label="Messages/mo" />
          <LimitItem icon={Users} value={plan.maxTeamMembers} label="Team Members" />
          <LimitItem icon={Database} value={`${plan.maxStorageGb} GB`} label="Storage" />

          <div className="pt-4 mt-4 border-t border-border/50 space-y-2.5">
            <FeatureItem enabled={plan.customBranding} label="Custom Branding" />
            <FeatureItem enabled={plan.prioritySupport} label="Priority Support" />
            <FeatureItem enabled={plan.apiAccess} label="API Access" />
            <FeatureItem enabled={plan.advancedAnalytics} label="Advanced Analytics" />
            <FeatureItem enabled={plan.customIntegrations} label="Custom Integrations" />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <Building2 size={14} />
            <span>
              {plan.companiesCount} {plan.companiesCount === 1 ? "company" : "companies"} subscribed
            </span>
          </div>
          <Button
            variant="outline"
            className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors"
            onPress={() => onEdit(plan)}
          >
            <Pencil size={14} />
            Edit Plan
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function LimitItem({ icon: Icon, value, label }: { icon: React.ElementType; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="p-1.5 rounded-lg bg-primary/10">
        <Icon size={14} className="text-primary" />
      </div>
      <span className="font-medium">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function FeatureItem({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <div className={cn(
        "p-0.5 rounded-full",
        enabled ? "bg-success/10" : "bg-muted"
      )}>
        {enabled ? (
          <Check size={12} className="text-success" />
        ) : (
          <X size={12} className="text-muted-foreground" />
        )}
      </div>
      <span className={cn(enabled ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </div>
  );
}
