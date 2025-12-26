"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { Label } from "./input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  description?: string;
  errorMessage?: string;
  isInvalid?: boolean;
  isRequired?: boolean;
  isDisabled?: boolean;
  onValueChange?: (value: string) => void;
  minRows?: number;
  classNames?: {
    input?: string;
  };
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      helperText,
      description,
      errorMessage,
      isInvalid,
      isRequired,
      isDisabled,
      disabled,
      required,
      onValueChange,
      onChange,
      minRows,
      classNames,
      ...props
    },
    ref
  ) => {
    const hasError = isInvalid || !!errorMessage;
    const helpText = errorMessage || helperText || description;
    const isFieldDisabled = disabled || isDisabled;
    const isFieldRequired = required || isRequired;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e);
      onValueChange?.(e.target.value);
    };

    // Calculate min-height based on minRows (each row ~24px)
    const minHeight = minRows ? `${minRows * 24}px` : undefined;

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label>
            {label}
            {isFieldRequired && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-[3px] border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            hasError && "border-destructive focus-visible:ring-destructive",
            classNames?.input
          )}
          style={minHeight ? { minHeight } : undefined}
          ref={ref}
          disabled={isFieldDisabled}
          required={isFieldRequired}
          aria-invalid={hasError}
          onChange={handleChange}
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

Textarea.displayName = "Textarea";
