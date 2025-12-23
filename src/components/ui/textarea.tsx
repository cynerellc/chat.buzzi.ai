"use client";

import { Textarea as HeroTextarea, type TextAreaProps as HeroTextAreaProps } from "@heroui/react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends HeroTextAreaProps {
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ helperText, description, className, ...props }, ref) => {
    return (
      <HeroTextarea
        ref={ref}
        className={cn(className)}
        description={helperText ?? description}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
