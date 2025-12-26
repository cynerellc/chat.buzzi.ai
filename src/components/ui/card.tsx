"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Base card primitives
const CardRoot = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "card-extended-corners border border-border bg-card text-card-foreground shadow-sm",
        "transition-all duration-200",
        className
      )}
      {...props}
    >
      <span className="corner-extensions" />
      {children}
    </div>
  )
);
CardRoot.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardBody.displayName = "CardBody";

const CardContent = CardBody; // Alias for shadcn compatibility

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

// Legacy wrapper
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  onClick?: () => void;
  isPressable?: boolean;
}

export function Card({ onClick, isPressable, className, ...props }: CardProps) {
  const isClickable = onClick || isPressable;

  return (
    <CardRoot
      className={cn(
        isClickable && "cursor-pointer hover:shadow-md transition-shadow",
        className
      )}
      onClick={onClick}
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
        ? "text-destructive"
        : "text-muted-foreground";

  const trendBgColor =
    trend === "up"
      ? "bg-success/10"
      : trend === "down"
        ? "bg-destructive/10"
        : "bg-muted";

  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : null;

  if (isLoading) {
    return (
      <Card className="p-5">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-muted rounded-md w-24" />
            <div className="h-10 w-10 bg-muted rounded-xl" />
          </div>
          <div className="h-8 bg-muted rounded-md w-20" />
          <div className="h-3 bg-muted rounded-md w-16" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      onClick={onClick}
      isPressable={!!onClick}
      className={cn(
        "p-5 group",
        onClick && "hover:border-primary/30"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && (
          <div className={cn(
            "p-2.5 rounded-xl transition-all duration-300",
            "bg-gradient-to-br from-primary/10 to-primary/5",
            iconColor,
            onClick && "group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20"
          )}>
            <Icon size={20} />
          </div>
        )}
      </div>
      <motion.p
        className="text-3xl font-bold tracking-tight"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        key={String(value)}
      >
        {value}
      </motion.p>
      {change !== undefined && (
        <motion.div
          className={cn("inline-flex items-center gap-1.5 mt-3 px-2 py-1 rounded-full text-xs font-medium", trendColor, trendBgColor)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          {TrendIcon && <TrendIcon size={12} />}
          <span>
            {change > 0 && "+"}
            {change}%
          </span>
          {changeLabel && <span className="text-muted-foreground ml-1">{changeLabel}</span>}
        </motion.div>
      )}
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

export function ClickableCard({
  title,
  description,
  icon: Icon,
  action,
  className,
  ...props
}: ClickableCardProps) {
  return (
    <Card
      className={cn(
        "group transition-all duration-300",
        "hover:shadow-xl hover:shadow-primary/5 hover:border-primary/40",
        "hover:-translate-y-0.5",
        className
      )}
      isPressable
      {...props}
    >
      <CardBody className="flex items-center gap-4 p-5">
        {Icon && (
          <div className={cn(
            "p-3.5 rounded-xl transition-all duration-300",
            "bg-gradient-to-br from-primary/15 to-primary/5 text-primary",
            "group-hover:from-primary group-hover:to-primary/90 group-hover:text-primary-foreground",
            "group-hover:shadow-lg group-hover:shadow-primary/25 group-hover:scale-105"
          )}>
            <Icon size={24} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</p>}
        </div>
        {action && (
          <div className="flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1">
            {action}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// Export primitives
export { CardRoot, CardHeader, CardTitle, CardDescription, CardBody, CardContent, CardFooter };
