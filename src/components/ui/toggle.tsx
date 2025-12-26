"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "@/lib/utils";

export interface ToggleProps extends ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  // Legacy HeroUI prop aliases
  isSelected?: boolean;
  isDisabled?: boolean;
  onValueChange?: (checked: boolean) => void;
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}

const sizeClasses = {
  sm: {
    root: "h-4 w-7",
    thumb: "h-3 w-3 data-[state=checked]:translate-x-3",
  },
  md: {
    root: "h-5 w-9",
    thumb: "h-4 w-4 data-[state=checked]:translate-x-4",
  },
  lg: {
    root: "h-6 w-11",
    thumb: "h-5 w-5 data-[state=checked]:translate-x-5",
  },
};

export const Toggle = forwardRef<ElementRef<typeof SwitchPrimitive.Root>, ToggleProps>(
  (
    {
      className,
      isSelected,
      isDisabled,
      onValueChange,
      onCheckedChange,
      checked,
      disabled,
      size = "md",
      children,
      ...props
    },
    ref
  ) => {
    const isChecked = checked ?? isSelected;
    const isFieldDisabled = disabled || isDisabled;
    const handleCheckedChange = onCheckedChange ?? onValueChange;

    const sizes = sizeClasses[size];

    return (
      <div className="flex items-center space-x-2">
        <SwitchPrimitive.Root
          ref={ref}
          className={cn(
            "peer inline-flex shrink-0 cursor-pointer items-center rounded-[3px] border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
            sizes.root,
            className
          )}
          checked={isChecked}
          disabled={isFieldDisabled}
          onCheckedChange={handleCheckedChange}
          {...props}
        >
          <SwitchPrimitive.Thumb
            className={cn(
              "pointer-events-none block rounded-[3px] bg-background shadow-lg ring-0 transition-transform data-[state=unchecked]:translate-x-0",
              sizes.thumb
            )}
          />
        </SwitchPrimitive.Root>
        {children && (
          <label
            className={cn(
              "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
              isFieldDisabled && "cursor-not-allowed opacity-70"
            )}
          >
            {children}
          </label>
        )}
      </div>
    );
  }
);

Toggle.displayName = "Toggle";

// Also export as Switch for those who prefer that naming
export const Switch = Toggle;
