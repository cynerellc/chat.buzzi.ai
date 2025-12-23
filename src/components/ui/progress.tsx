"use client";

import { Progress as HeroProgress, type ProgressProps as HeroProgressProps } from "@heroui/react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface ProgressProps extends HeroProgressProps {
  helperText?: string;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, ...props }, ref) => {
    return (
      <HeroProgress
        ref={ref}
        className={cn(className)}
        {...props}
      />
    );
  }
);

Progress.displayName = "Progress";
