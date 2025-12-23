"use client";

import { Tooltip as HeroTooltip, type TooltipProps as HeroTooltipProps } from "@heroui/react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface TooltipProps extends HeroTooltipProps {
  shortcut?: string;
}

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  ({ shortcut, content, className, delay = 500, closeDelay = 0, ...props }, ref) => {
    const tooltipContent = shortcut ? (
      <div className="flex items-center gap-2">
        <span>{content}</span>
        <kbd className="px-1.5 py-0.5 text-xs bg-default-200 rounded">{shortcut}</kbd>
      </div>
    ) : (
      content
    );

    return (
      <HeroTooltip
        ref={ref}
        content={tooltipContent}
        delay={delay}
        closeDelay={closeDelay}
        className={cn("text-sm", className)}
        {...props}
      />
    );
  }
);

Tooltip.displayName = "Tooltip";
