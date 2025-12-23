"use client";

import { Switch as HeroSwitch, type SwitchProps as HeroSwitchProps } from "@heroui/react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface ToggleProps extends HeroSwitchProps {
  helperText?: string;
}

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, ...props }, ref) => {
    return (
      <HeroSwitch
        ref={ref}
        className={cn(className)}
        {...props}
      />
    );
  }
);

Toggle.displayName = "Toggle";

// Also export as Switch for those who prefer that naming
export const Switch = Toggle;
