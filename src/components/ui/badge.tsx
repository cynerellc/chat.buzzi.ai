"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        success: "bg-success/20 text-success-foreground dark:text-success",
        warning: "bg-warning/20 text-warning-foreground dark:text-warning",
        danger: "bg-destructive/20 text-destructive",
        info: "bg-primary/20 text-primary",
        secondary: "bg-secondary/20 text-secondary",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "secondary";

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";

// Status badge with dot indicator
export interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  status: "active" | "inactive" | "pending" | "error" | "success" | "warning";
}

const statusConfig: Record<
  StatusBadgeProps["status"],
  { variant: BadgeVariant; dotColor: string; label: string }
> = {
  active: { variant: "success", dotColor: "bg-success", label: "Active" },
  inactive: { variant: "default", dotColor: "bg-muted-foreground", label: "Inactive" },
  pending: { variant: "warning", dotColor: "bg-warning", label: "Pending" },
  error: { variant: "danger", dotColor: "bg-destructive", label: "Error" },
  success: { variant: "success", dotColor: "bg-success", label: "Success" },
  warning: { variant: "warning", dotColor: "bg-warning", label: "Warning" },
};

export function StatusBadge({ status, children, className, ...props }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={cn("gap-1.5", className)} {...props}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotColor)} />
      {children ?? config.label}
    </Badge>
  );
}

// Count badge (for notifications, etc.)
export interface CountBadgeProps {
  count: number;
  maxCount?: number;
  variant?: BadgeVariant;
  className?: string;
}

export function CountBadge({
  count,
  maxCount = 99,
  variant = "danger",
  className,
}: CountBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : count;

  return (
    <Badge
      variant={variant}
      size="sm"
      className={cn("min-w-5 justify-center px-1", className)}
    >
      {displayCount}
    </Badge>
  );
}

// Chip component - HeroUI compatibility alias for Badge
export interface ChipProps extends Omit<BadgeProps, "variant"> {
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  // HeroUI variant - 'flat' is default in shadcn
  chipVariant?: "solid" | "flat" | "bordered" | "light" | "faded" | "shadow" | "dot";
  // Close button callback - when provided, shows close button
  onClose?: () => void;
}

// Map HeroUI color to Badge variant
function mapColorToVariant(color?: ChipProps["color"]): BadgeVariant {
  switch (color) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "danger";
    case "primary":
      return "info";
    case "secondary":
      return "secondary";
    default:
      return "default";
  }
}

export function Chip({
  color = "default",
  chipVariant = "flat",
  className,
  children,
  onClose,
  ...props
}: ChipProps) {
  const variant = mapColorToVariant(color);

  return (
    <Badge variant={variant} className={cn("inline-flex items-center gap-1", className)} {...props}>
      {children}
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1 rounded-full p-0.5 hover:bg-background/20 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </Badge>
  );
}
