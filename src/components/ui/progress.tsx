"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "@/lib/utils";

export interface ProgressProps extends ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  // Legacy HeroUI props
  label?: string;
  showValueLabel?: boolean;
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  isIndeterminate?: boolean;
}

const colorClasses: Record<string, string> = {
  default: "bg-foreground",
  primary: "bg-primary",
  secondary: "bg-secondary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

const sizeClasses: Record<string, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

export const Progress = forwardRef<ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  (
    {
      className,
      value,
      label,
      showValueLabel,
      color = "primary",
      size = "md",
      isIndeterminate,
      ...props
    },
    ref
  ) => {
    return (
      <div className="space-y-1">
        {(label || showValueLabel) && (
          <div className="flex justify-between text-sm">
            {label && <span className="text-muted-foreground">{label}</span>}
            {showValueLabel && !isIndeterminate && (
              <span className="text-muted-foreground">{value}%</span>
            )}
          </div>
        )}
        <ProgressPrimitive.Root
          ref={ref}
          className={cn(
            "relative w-full overflow-hidden rounded-[3px] bg-secondary",
            sizeClasses[size],
            className
          )}
          value={isIndeterminate ? undefined : value}
          {...props}
        >
          <ProgressPrimitive.Indicator
            className={cn(
              "h-full w-full flex-1 transition-all",
              colorClasses[color],
              isIndeterminate && "animate-pulse"
            )}
            style={{
              transform: isIndeterminate
                ? undefined
                : `translateX(-${100 - (value || 0)}%)`,
            }}
          />
        </ProgressPrimitive.Root>
      </div>
    );
  }
);

Progress.displayName = "Progress";
