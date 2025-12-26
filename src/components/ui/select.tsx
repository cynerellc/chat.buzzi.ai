"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "@/lib/utils";
import { Label } from "./input";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps extends ComponentPropsWithoutRef<typeof SelectPrimitive.Root> {
  options: SelectOption[];
  label?: string;
  placeholder?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  helperText?: string;
  description?: string;
  errorMessage?: string;
  className?: string;
  // Legacy HeroUI props
  selectedKeys?: Set<string> | string[];
  onSelectionChange?: (keys: Set<string>) => void;
}

export const Select = forwardRef<ElementRef<typeof SelectPrimitive.Trigger>, SelectProps>(
  (
    {
      options,
      label,
      placeholder = "Select an option",
      isLoading,
      isDisabled,
      isRequired,
      isInvalid,
      helperText,
      description,
      errorMessage,
      className,
      selectedKeys,
      onSelectionChange,
      value,
      onValueChange,
      disabled,
      ...props
    },
    ref
  ) => {
    const hasError = isInvalid || !!errorMessage;
    const helpText = errorMessage || helperText || description;
    const isFieldDisabled = disabled || isDisabled || isLoading;

    // Handle legacy selectedKeys prop
    const resolvedValue = value ?? (selectedKeys ? Array.from(selectedKeys)[0] : undefined);

    const handleValueChange = (newValue: string) => {
      onValueChange?.(newValue);
      onSelectionChange?.(new Set([newValue]));
    };

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label>
            {label}
            {isRequired && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <SelectPrimitive.Root
          value={resolvedValue}
          onValueChange={handleValueChange}
          disabled={isFieldDisabled}
          {...props}
        >
          <SelectPrimitive.Trigger
            ref={ref}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-[3px] border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
              hasError && "border-destructive focus:ring-destructive"
            )}
          >
            <SelectPrimitive.Value placeholder={isLoading ? "Loading..." : placeholder} />
            <SelectPrimitive.Icon asChild>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin opacity-50" />
              ) : (
                <ChevronDown className="h-4 w-4 opacity-50" />
              )}
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
              position="popper"
              sideOffset={4}
            >
              <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
                <ChevronUp className="h-4 w-4" />
              </SelectPrimitive.ScrollUpButton>
              <SelectPrimitive.Viewport className="p-1">
                {options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <Check className="h-4 w-4" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <div>
                      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                      {option.description && (
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      )}
                    </div>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
              <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
                <ChevronDown className="h-4 w-4" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
        {helpText && (
          <p className={cn("text-sm", hasError ? "text-destructive" : "text-muted-foreground")}>
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

// Export SelectItem for cases where it's used directly
export const SelectItem = SelectPrimitive.Item;
