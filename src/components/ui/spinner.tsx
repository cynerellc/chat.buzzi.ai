"use client";

import { Loader2 } from "lucide-react";
import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger" | "current";
  label?: string;
  labelColor?: "foreground" | "primary" | "secondary" | "success" | "warning" | "danger";
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

const colorClasses = {
  default: "text-muted-foreground",
  primary: "text-primary",
  secondary: "text-secondary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  current: "text-current",
};

const labelColorClasses = {
  foreground: "text-foreground",
  primary: "text-primary",
  secondary: "text-secondary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  (
    { className, size = "md", color = "primary", label, labelColor = "foreground", ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        role="status"
        className={cn("inline-flex flex-col items-center justify-center gap-2", className)}
        {...props}
      >
        <Loader2
          className={cn("animate-spin", sizeClasses[size], colorClasses[color])}
          aria-hidden="true"
        />
        {label && (
          <span className={cn("text-sm", labelColorClasses[labelColor])}>{label}</span>
        )}
        <span className="sr-only">{label || "Loading..."}</span>
      </div>
    );
  }
);

Spinner.displayName = "Spinner";
