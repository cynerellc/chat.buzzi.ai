"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "@/lib/utils";
import { Label } from "./input";

export interface SliderProps extends ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  label?: string;
  helperText?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: {
    track: "h-1",
    thumb: "h-3 w-3",
  },
  md: {
    track: "h-2",
    thumb: "h-4 w-4",
  },
  lg: {
    track: "h-3",
    thumb: "h-5 w-5",
  },
};

export const Slider = forwardRef<ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  (
    {
      className,
      label,
      helperText,
      showValue,
      formatValue,
      size = "md",
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const sizes = sizeClasses[size];
    const currentValue = value ?? defaultValue ?? [0];
    const firstValue = currentValue[0] ?? 0;
    const displayValue = formatValue
      ? formatValue(firstValue)
      : firstValue;

    return (
      <div className="space-y-2">
        {(label || showValue) && (
          <div className="flex justify-between">
            {label && <Label>{label}</Label>}
            {showValue && (
              <span className="text-sm text-muted-foreground">{displayValue}</span>
            )}
          </div>
        )}
        <SliderPrimitive.Root
          ref={ref}
          className={cn(
            "relative flex w-full touch-none select-none items-center",
            className
          )}
          value={value}
          defaultValue={defaultValue}
          {...props}
        >
          <SliderPrimitive.Track
            className={cn(
              "relative w-full grow overflow-hidden rounded-[1px] bg-secondary",
              sizes.track
            )}
          >
            <SliderPrimitive.Range className="absolute h-full rounded-[1px] bg-primary" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className={cn(
              "block rounded-[1px] border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
              sizes.thumb
            )}
          />
        </SliderPrimitive.Root>
        {helperText && (
          <p className="text-sm text-muted-foreground">{helperText}</p>
        )}
      </div>
    );
  }
);

Slider.displayName = "Slider";
