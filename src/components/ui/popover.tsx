"use client";

import {
  Popover as HeroPopover,
  PopoverTrigger as HeroPopoverTrigger,
  PopoverContent as HeroPopoverContent,
  type PopoverProps as HeroPopoverProps,
  type PopoverContentProps as HeroPopoverContentProps,
} from "@heroui/react";
import { forwardRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PopoverProps extends Omit<HeroPopoverProps, "children"> {
  trigger: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  contentProps?: Omit<HeroPopoverContentProps, "children">;
}

export const Popover = forwardRef<HTMLDivElement, PopoverProps>(
  ({ trigger, children, className, contentClassName, contentProps, ...props }, ref) => {
    return (
      <HeroPopover
        ref={ref}
        className={cn(className)}
        {...props}
      >
        <HeroPopoverTrigger>
          {trigger}
        </HeroPopoverTrigger>
        <HeroPopoverContent className={cn(contentClassName)} {...contentProps}>
          {children}
        </HeroPopoverContent>
      </HeroPopover>
    );
  }
);

Popover.displayName = "Popover";

// Also export individual components for more control
export { HeroPopover as PopoverBase, HeroPopoverTrigger as PopoverTrigger, HeroPopoverContent as PopoverContent };
export type { HeroPopoverContentProps as PopoverContentProps };
