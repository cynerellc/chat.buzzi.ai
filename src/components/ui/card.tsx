"use client";

import {
  Card as HeroCard,
  CardHeader as HeroCardHeader,
  CardBody as HeroCardBody,
  CardFooter as HeroCardFooter,
  type CardProps as HeroCardProps,
} from "@heroui/react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface CardProps extends Omit<HeroCardProps, "ref"> {
  onClick?: () => void;
}

export function Card({ onClick, className, ...props }: CardProps) {
  return (
    <HeroCard
      className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow", className)}
      isPressable={!!onClick}
      onPress={onClick}
      {...props}
    />
  );
}

// Stat card for dashboard metrics
export interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: "up" | "down" | "neutral";
  onClick?: () => void;
  isLoading?: boolean;
}

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = "text-primary",
  trend,
  onClick,
  isLoading,
}: StatCardProps) {
  const trendColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-danger"
        : "text-default-500";

  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : null;

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-default-200 rounded w-1/2" />
          <div className="h-8 bg-default-200 rounded w-3/4" />
          <div className="h-3 bg-default-200 rounded w-1/3" />
        </div>
      </Card>
    );
  }

  return (
    <Card onClick={onClick} className="p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-default-500">{title}</p>
          <motion.p
            className="text-2xl font-bold"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={String(value)}
          >
            {value}
          </motion.p>
          {change !== undefined && (
            <div className={cn("flex items-center gap-1 text-sm", trendColor)}>
              {TrendIcon && <TrendIcon size={14} />}
              <span>
                {change > 0 && "+"}
                {change}%
              </span>
              {changeLabel && <span className="text-default-400">{changeLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("p-2 rounded-lg bg-default-100", iconColor)}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </Card>
  );
}

// Clickable card with hover effect
export interface ClickableCardProps extends CardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

export function ClickableCard({ title, description, icon: Icon, action, className, ...props }: ClickableCardProps) {
  return (
    <Card
      className={cn(
        "group transition-all duration-200 hover:shadow-lg hover:border-primary/50",
        className
      )}
      {...props}
    >
      <HeroCardBody className="flex items-center gap-4">
        {Icon && (
          <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
            <Icon size={24} />
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-sm text-default-500">{description}</p>}
        </div>
        {action}
      </HeroCardBody>
    </Card>
  );
}

export { HeroCardHeader as CardHeader, HeroCardBody as CardBody, HeroCardFooter as CardFooter };
