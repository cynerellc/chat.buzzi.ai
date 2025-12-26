"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "@/lib/utils";

export interface CheckboxProps extends ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  // Legacy HeroUI prop aliases
  isSelected?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  onValueChange?: (checked: boolean) => void;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

const labelSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export const Checkbox = forwardRef<ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  (
    {
      className,
      isSelected,
      isDisabled,
      isInvalid,
      onValueChange,
      onCheckedChange,
      checked,
      disabled,
      children,
      size = "md",
      ...props
    },
    ref
  ) => {
    const isChecked = checked ?? isSelected;
    const isFieldDisabled = disabled || isDisabled;
    const handleCheckedChange = onCheckedChange ?? onValueChange;

    return (
      <div className="flex items-center space-x-2">
        <CheckboxPrimitive.Root
          ref={ref}
          className={cn(
            "peer shrink-0 rounded-sm border ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
            sizeClasses[size],
            isInvalid ? "border-destructive" : "border-primary",
            className
          )}
          checked={isChecked}
          disabled={isFieldDisabled}
          onCheckedChange={handleCheckedChange}
          {...props}
        >
          <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
            <Check className={sizeClasses[size]} />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        {children && (
          <label
            className={cn(
              "font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
              labelSizeClasses[size],
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

Checkbox.displayName = "Checkbox";
