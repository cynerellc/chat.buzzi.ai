"use client";

import { motion } from "framer-motion";
import {
  Bot,
  Briefcase,
  HelpCircle,
  Headphones,
  Settings,
  User,
  Users,
  Layers,
  ArrowRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { PackageListItem } from "@/hooks/master-admin";
import { Badge, Button, Card, type BadgeVariant } from "@/components/ui";

interface PackageCardProps {
  package: PackageListItem;
  onConfigure: (pkg: PackageListItem) => void;
}

const categoryConfig: Record<string, { icon: typeof Bot; gradient: string; iconBg: string }> = {
  support: {
    icon: Headphones,
    gradient: "from-blue-500/20 to-blue-600/10",
    iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  sales: {
    icon: Briefcase,
    gradient: "from-emerald-500/20 to-emerald-600/10",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  faq: {
    icon: HelpCircle,
    gradient: "from-amber-500/20 to-amber-600/10",
    iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  custom: {
    icon: Settings,
    gradient: "from-violet-500/20 to-violet-600/10",
    iconBg: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
};

export function PackageCard({ package: pkg, onConfigure }: PackageCardProps) {
  const category = categoryConfig[pkg.category ?? "custom"] ?? categoryConfig.custom;
  const Icon = category.icon;
  const isMultiAgent = pkg.packageType === "multi_agent";
  const packageAgentsCount = pkg.packageAgentsCount ?? 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="group p-5 flex flex-col h-full hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "p-3 rounded-2xl transition-all duration-300",
            category.iconBg,
            "group-hover:scale-110 group-hover:shadow-lg"
          )}>
            <Icon size={24} />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
              isMultiAgent ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "bg-muted text-muted-foreground"
            )}>
              {isMultiAgent ? (
                <>
                  <Users size={11} />
                  {packageAgentsCount} Agents
                </>
              ) : (
                <>
                  <User size={11} />
                  Single Agent
                </>
              )}
            </div>
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
              pkg.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full", pkg.isActive ? "bg-success animate-pulse" : "bg-muted-foreground")} />
              {pkg.isActive ? "Active" : "Inactive"}
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">{pkg.name}</h3>
        {pkg.category && (
          <span className={cn(
            "inline-flex items-center w-fit mt-2 px-2.5 py-0.5 rounded-lg text-xs font-medium capitalize",
            category.iconBg
          )}>
            {pkg.category}
          </span>
        )}

        {pkg.description && (
          <p className="text-sm text-muted-foreground flex-1 mt-3 line-clamp-3">
            {pkg.description}
          </p>
        )}

        <div className="mt-auto pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <Layers size={14} />
            <span>
              {pkg.agentsCount} {pkg.agentsCount === 1 ? "deployment" : "deployments"}
            </span>
          </div>
          <Button
            variant="outline"
            className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors"
            onPress={() => onConfigure(pkg)}
          >
            Configure
            <ArrowRight size={14} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
