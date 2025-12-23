"use client";

import { AlertCircle, CheckCircle2, Info, XCircle, X, type LucideIcon } from "lucide-react";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type AlertVariant = "default" | "info" | "success" | "warning" | "error";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  icon?: LucideIcon | false;
  onDismiss?: () => void;
  children?: ReactNode;
}

const variantStyles: Record<AlertVariant, string> = {
  default: "bg-default-100 text-default-800 border-default-200",
  info: "bg-primary-50 text-primary-800 border-primary-200",
  success: "bg-success-50 text-success-800 border-success-200",
  warning: "bg-warning-50 text-warning-800 border-warning-200",
  error: "bg-danger-50 text-danger-800 border-danger-200",
};

const variantIcons: Record<AlertVariant, LucideIcon> = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = "default", title, icon, onDismiss, className, children, ...props }, ref) => {
    const Icon = icon === false ? null : (icon ?? variantIcons[variant]);

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative flex gap-3 rounded-lg border p-4",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {Icon && (
          <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <h5 className="font-medium mb-1">{title}</h5>
          )}
          <div className="text-sm">{children}</div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 rounded-md p-1 hover:bg-black/5 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = "Alert";
