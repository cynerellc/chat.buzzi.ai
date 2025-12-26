"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { type LucideIcon, X } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Label component
const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

export const Label = forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

// Base input styles
const inputVariants = cva(
  "flex h-10 w-full rounded-[3px] border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      hasError: {
        true: "border-destructive focus-visible:ring-destructive",
        false: "",
      },
    },
    defaultVariants: {
      hasError: false,
    },
  }
);

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  startContent?: ReactNode;
  endContent?: ReactNode;
  iconSize?: number;
  helperText?: string;
  description?: string;
  errorMessage?: string;
  isInvalid?: boolean;
  isRequired?: boolean;
  isDisabled?: boolean;
  isClearable?: boolean;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      label,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      startContent,
      endContent,
      iconSize = 18,
      helperText,
      description,
      errorMessage,
      isInvalid,
      isRequired,
      isDisabled,
      isClearable,
      disabled,
      required,
      onChange,
      onValueChange,
      onClear,
      value,
      ...props
    },
    ref
  ) => {
    const hasError = isInvalid || !!errorMessage;
    const helpText = errorMessage || helperText || description;
    const isFieldDisabled = disabled || isDisabled;
    const isFieldRequired = required || isRequired;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onValueChange?.(e.target.value);
    };

    const handleClear = () => {
      onClear?.();
      onValueChange?.("");
    };

    const leftContent = startContent || (LeftIcon && <LeftIcon size={iconSize} className="text-muted-foreground" />);

    // Show clear button if isClearable and has value
    const showClearButton = isClearable && value && String(value).length > 0;
    const rightContent = showClearButton ? (
      <button
        type="button"
        onClick={handleClear}
        className="text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        <X size={16} />
      </button>
    ) : endContent || (RightIcon && <RightIcon size={iconSize} className="text-muted-foreground" />);

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label>
            {label}
            {isFieldRequired && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <div className="relative">
          {leftContent && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leftContent}
            </div>
          )}
          <input
            type={type}
            className={cn(
              inputVariants({ hasError }),
              leftContent && "pl-10",
              rightContent && "pr-10"
            )}
            ref={ref}
            disabled={isFieldDisabled}
            required={isFieldRequired}
            aria-invalid={hasError}
            onChange={handleChange}
            value={value}
            {...props}
          />
          {rightContent && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightContent}
            </div>
          )}
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

Input.displayName = "Input";

export { inputVariants, labelVariants };
