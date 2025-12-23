"use client";

import { Checkbox as HeroCheckbox, type CheckboxProps as HeroCheckboxProps } from "@heroui/react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface CheckboxProps extends HeroCheckboxProps {
  helperText?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ helperText, className, ...props }, ref) => {
    return (
      <HeroCheckbox
        ref={ref}
        className={cn(className)}
        {...props}
      />
    );
  }
);

Checkbox.displayName = "Checkbox";
