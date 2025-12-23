"use client";

import { Chip, type ChipProps } from "@heroui/react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

export interface BadgeProps extends Omit<ChipProps, "variant" | "color"> {
  variant?: BadgeVariant;
}

const variantColorMap: Record<BadgeVariant, ChipProps["color"]> = {
  default: "default",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "primary",
};

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ variant = "default", className, ...props }, ref) => {
    return (
      <Chip
        ref={ref}
        size="sm"
        variant="flat"
        color={variantColorMap[variant]}
        className={cn("font-medium", className)}
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

const statusConfig: Record<StatusBadgeProps["status"], { color: ChipProps["color"]; label: string }> = {
  active: { color: "success", label: "Active" },
  inactive: { color: "default", label: "Inactive" },
  pending: { color: "warning", label: "Pending" },
  error: { color: "danger", label: "Error" },
  success: { color: "success", label: "Success" },
  warning: { color: "warning", label: "Warning" },
};

export function StatusBadge({ status, children, className, ...props }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Chip
      size="sm"
      variant="dot"
      color={config.color}
      className={cn("capitalize", className)}
      {...props}
    >
      {children ?? config.label}
    </Chip>
  );
}

// Count badge (for notifications, etc.)
export interface CountBadgeProps {
  count: number;
  maxCount?: number;
  color?: ChipProps["color"];
  className?: string;
}

export function CountBadge({ count, maxCount = 99, color = "danger", className }: CountBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : count;

  return (
    <Chip
      size="sm"
      color={color}
      className={cn("min-w-5 h-5 px-1 text-xs font-medium", className)}
    >
      {displayCount}
    </Chip>
  );
}
