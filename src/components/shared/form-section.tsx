"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface FormSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {description && <p className="text-sm text-default-500">{description}</p>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// Form section with visual separation
export interface FormSectionCardProps extends FormSectionProps {
  noPadding?: boolean;
}

export function FormSectionCard({
  title,
  description,
  children,
  className,
  noPadding,
}: FormSectionCardProps) {
  return (
    <div className={cn("bg-content1 rounded-xl border border-divider", className)}>
      {(title || description) && (
        <div className="px-6 py-4 border-b border-divider">
          {title && <h3 className="text-base font-semibold">{title}</h3>}
          {description && <p className="text-sm text-default-500 mt-0.5">{description}</p>}
        </div>
      )}
      <div className={cn(!noPadding && "p-6", "space-y-4")}>{children}</div>
    </div>
  );
}

// Row layout for form fields
export interface FormRowProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function FormRow({ children, columns = 2, className }: FormRowProps) {
  const columnClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", columnClasses[columns], className)}>{children}</div>
  );
}

// Divider with optional label
export interface FormDividerProps {
  label?: string;
  className?: string;
}

export function FormDivider({ label, className }: FormDividerProps) {
  if (label) {
    return (
      <div className={cn("relative py-4", className)}>
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-divider" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 bg-background text-sm text-default-500">{label}</span>
        </div>
      </div>
    );
  }

  return <div className={cn("border-t border-divider my-4", className)} />;
}
