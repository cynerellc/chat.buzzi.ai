"use client";

import {
  Select as HeroSelect,
  SelectItem as HeroSelectItem,
  type SelectProps as HeroSelectProps,
} from "@heroui/react";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<HeroSelectProps, "children"> {
  options: SelectOption[];
  isLoading?: boolean;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, isLoading, helperText, description, className, placeholder, ...props }, ref) => {
    return (
      <HeroSelect
        ref={ref}
        className={cn(className)}
        description={helperText ?? description}
        placeholder={isLoading ? "Loading..." : placeholder}
        isDisabled={isLoading || props.isDisabled}
        selectorIcon={isLoading ? <Loader2 className="animate-spin" size={16} /> : undefined}
        {...props}
      >
        {options.map((option) => (
          <HeroSelectItem
            key={option.value}
            description={option.description}
            isDisabled={option.disabled}
          >
            {option.label}
          </HeroSelectItem>
        ))}
      </HeroSelect>
    );
  }
);

Select.displayName = "Select";

export { HeroSelectItem as SelectItem };
