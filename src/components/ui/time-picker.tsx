"use client";

import { Clock } from "lucide-react";
import { forwardRef, useState, useEffect } from "react";

import { cn } from "@/lib/utils";
import { Input, Label } from "./input";

export interface TimePickerProps {
  value?: string; // Format: "HH:mm" or "HH:mm:ss"
  onChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  description?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  isDisabled?: boolean;
  className?: string;
  hourCycle?: 12 | 24;
  granularity?: "hour" | "minute" | "second";
  minValue?: string;
  maxValue?: string;
}

export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  (
    {
      value,
      onChange,
      label,
      placeholder = "Select time",
      helperText,
      description,
      isRequired,
      isInvalid,
      errorMessage,
      isDisabled,
      className,
      hourCycle = 24,
      granularity = "minute",
      minValue,
      maxValue,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState(value || "");

    useEffect(() => {
      if (value !== undefined) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync state with prop changes
        setInternalValue(value);
      }
    }, [value]);

    const hasError = isInvalid || !!errorMessage;
    const helpText = errorMessage || helperText || description;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      onChange?.(newValue);
    };

    // Calculate step based on granularity
    const step = granularity === "second" ? 1 : granularity === "minute" ? 60 : 3600;

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label>
            {label}
            {isRequired && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <div className="relative">
          <Input
            ref={ref}
            type="time"
            value={internalValue}
            onChange={handleChange}
            disabled={isDisabled}
            placeholder={placeholder}
            step={step}
            min={minValue}
            max={maxValue}
            className={cn(
              "pr-10",
              hasError && "border-destructive focus:ring-destructive"
            )}
          />
          <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        {helpText && (
          <p className={cn("text-sm", hasError ? "text-destructive" : "text-muted-foreground")}>
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

TimePicker.displayName = "TimePicker";

// Legacy alias
export const TimeInput = TimePicker;
