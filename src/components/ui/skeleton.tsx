"use client";

import { cn } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
  isLoaded?: boolean;
  children?: React.ReactNode;
}

export function Skeleton({ className, isLoaded, children }: SkeletonProps) {
  if (isLoaded) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
    >
      {children}
    </div>
  );
}

// Pre-defined skeleton shapes
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 && "w-3/4")} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 space-y-4 rounded-xl border border-border", className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function SkeletonAvatar({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-14 h-14",
  };

  return <Skeleton className={cn("rounded-full", sizeClasses[size], className)} />;
}

export function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-10 w-24 rounded-lg", className)} />;
}

export function SkeletonImage({ className }: { className?: string }) {
  return <Skeleton className={cn("aspect-video rounded-lg", className)} />;
}
