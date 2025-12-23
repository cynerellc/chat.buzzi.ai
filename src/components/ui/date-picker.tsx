"use client";

import { DatePicker as HeroDatePicker, type DatePickerProps as HeroDatePickerProps } from "@heroui/react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface DatePickerProps extends HeroDatePickerProps {
  helperText?: string;
}

export const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(
  ({ helperText, description, className, ...props }, ref) => {
    return (
      <HeroDatePicker
        ref={ref}
        className={cn(className)}
        description={helperText ?? description}
        {...props}
      />
    );
  }
);

DatePicker.displayName = "DatePicker";
