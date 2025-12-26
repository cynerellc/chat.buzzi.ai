"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "@/lib/utils";
import { Label } from "./input";

export interface RadioGroupProps extends ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  label?: string;
  helperText?: string;
  description?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
}

export const RadioGroup = forwardRef<ElementRef<typeof RadioGroupPrimitive.Root>, RadioGroupProps>(
  (
    {
      className,
      label,
      helperText,
      description,
      isRequired,
      isInvalid,
      errorMessage,
      ...props
    },
    ref
  ) => {
    const hasError = isInvalid || !!errorMessage;
    const helpText = errorMessage || helperText || description;

    return (
      <div className="space-y-2">
        {label && (
          <Label>
            {label}
            {isRequired && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <RadioGroupPrimitive.Root
          ref={ref}
          className={cn("grid gap-2", className)}
          {...props}
        />
        {helpText && (
          <p className={cn("text-sm", hasError ? "text-destructive" : "text-muted-foreground")}>
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

RadioGroup.displayName = "RadioGroup";

export interface RadioProps extends ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  children?: React.ReactNode;
}

export const Radio = forwardRef<ElementRef<typeof RadioGroupPrimitive.Item>, RadioProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="flex items-center space-x-2">
        <RadioGroupPrimitive.Item
          ref={ref}
          className={cn(
            "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        >
          <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
            <Circle className="h-2.5 w-2.5 fill-current text-current" />
          </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
        {children && (
          <label
            htmlFor={props.id}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {children}
          </label>
        )}
      </div>
    );
  }
);

Radio.displayName = "Radio";

// Alias for RadioGroupItem pattern compatibility
export const RadioGroupItem = Radio;
