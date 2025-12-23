"use client";

import { TimeInput as HeroTimeInput, type TimeInputProps as HeroTimeInputProps } from "@heroui/react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface TimePickerProps extends HeroTimeInputProps {
  helperText?: string;
}

export const TimePicker = forwardRef<HTMLDivElement, TimePickerProps>(
  ({ helperText, description, className, ...props }, ref) => {
    return (
      <HeroTimeInput
        ref={ref}
        className={cn(className)}
        description={helperText ?? description}
        {...props}
      />
    );
  }
);

TimePicker.displayName = "TimePicker";

// Also export as TimeInput for those who prefer that naming
export const TimeInput = TimePicker;
