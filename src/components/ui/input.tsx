"use client";

import { Input as HeroInput, type InputProps as HeroInputProps } from "@heroui/react";
import { type LucideIcon } from "lucide-react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends HeroInputProps {
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  iconSize?: number;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ leftIcon: LeftIcon, rightIcon: RightIcon, iconSize = 18, helperText, description, className, ...props }, ref) => {
    return (
      <HeroInput
        ref={ref}
        className={cn(className)}
        description={helperText ?? description}
        startContent={LeftIcon && <LeftIcon size={iconSize} className="text-default-400" />}
        endContent={RightIcon && <RightIcon size={iconSize} className="text-default-400" />}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
