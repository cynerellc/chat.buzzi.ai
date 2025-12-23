"use client";

import { Button as HeroButton, type ButtonProps as HeroButtonProps } from "@heroui/react";
import { Loader2, type LucideIcon } from "lucide-react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface ButtonProps extends HeroButtonProps {
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  iconSize?: number;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ leftIcon: LeftIcon, rightIcon: RightIcon, iconSize = 16, children, isLoading, className, ...props }, ref) => {
    return (
      <HeroButton
        ref={ref}
        className={cn("font-medium", className)}
        isLoading={isLoading}
        spinner={<Loader2 className="animate-spin" size={iconSize} />}
        {...props}
      >
        {!isLoading && LeftIcon && <LeftIcon size={iconSize} />}
        {children}
        {!isLoading && RightIcon && <RightIcon size={iconSize} />}
      </HeroButton>
    );
  }
);

Button.displayName = "Button";

// Convenience variants
export interface IconButtonProps extends Omit<ButtonProps, "leftIcon" | "rightIcon" | "children"> {
  icon: LucideIcon;
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, iconSize = 18, className, ...props }, ref) => {
    return (
      <HeroButton ref={ref} isIconOnly className={cn("min-w-0", className)} {...props}>
        <Icon size={iconSize} />
      </HeroButton>
    );
  }
);

IconButton.displayName = "IconButton";
