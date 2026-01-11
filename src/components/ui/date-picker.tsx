"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { forwardRef, useState } from "react";
import { DayPicker, type PropsBase, type PropsSingle } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "./button";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "./popover";
import { Label } from "./input";

// Calendar component using react-day-picker
// Combine base props with single-selection props, excluding mode (we force "single")
export type CalendarProps = Omit<PropsBase, "mode"> & Omit<PropsSingle, "mode">;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  // Extract only the props that DayPicker expects, excluding mode which we handle
  const { selected, onSelect, required, ...baseProps } = props;
  return (
    <DayPicker
      mode="single"
      selected={selected}
      onSelect={onSelect}
      required={required}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      {...baseProps}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          "hover:bg-accent hover:text-accent-foreground",
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
    />
  );
}

// DatePicker component
export interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  description?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  isDisabled?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
}

export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      label,
      placeholder = "Pick a date",
      helperText,
      description,
      isRequired,
      isInvalid,
      errorMessage,
      isDisabled,
      className,
      minDate,
      maxDate,
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);

    const hasError = isInvalid || !!errorMessage;
    const helpText = errorMessage || helperText || description;

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label>
            {label}
            {isRequired && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <PopoverRoot open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              variant="outline"
              disabled={isDisabled}
              className={cn(
                "w-full justify-start text-left font-normal",
                !value && "text-muted-foreground",
                hasError && "border-destructive focus:ring-destructive"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? format(value, "PPP") : <span>{placeholder}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              selected={value}
              onSelect={(date) => {
                onChange?.(date);
                setOpen(false);
              }}
              disabled={(date) => {
                if (minDate && date < minDate) return true;
                if (maxDate && date > maxDate) return true;
                return false;
              }}
              initialFocus
            />
          </PopoverContent>
        </PopoverRoot>
        {helpText && (
          <p className={cn("text-sm", hasError ? "text-destructive" : "text-muted-foreground")}>
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";
