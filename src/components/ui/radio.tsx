"use client";

import {
  Radio as HeroRadio,
  RadioGroup as HeroRadioGroup,
  type RadioProps as HeroRadioProps,
  type RadioGroupProps as HeroRadioGroupProps,
} from "@heroui/react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export type RadioProps = HeroRadioProps;

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className, ...props }, ref) => {
    return (
      <HeroRadio
        ref={ref}
        className={cn(className)}
        {...props}
      />
    );
  }
);

Radio.displayName = "Radio";

export interface RadioGroupProps extends HeroRadioGroupProps {
  helperText?: string;
}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ helperText, description, className, ...props }, ref) => {
    return (
      <HeroRadioGroup
        ref={ref}
        className={cn(className)}
        description={helperText ?? description}
        {...props}
      />
    );
  }
);

RadioGroup.displayName = "RadioGroup";
