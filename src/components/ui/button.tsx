"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2, type LucideIcon } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[1px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground hover:bg-success/90",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  iconSize?: number;
  isLoading?: boolean;
  // Legacy HeroUI prop aliases for compatibility
  isDisabled?: boolean;
  onPress?: () => void;
  color?: "primary" | "secondary" | "success" | "warning" | "danger" | "default";
  // HeroUI content props
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
}

const colorToVariantMap: Record<string, ButtonProps["variant"]> = {
  primary: "default",
  secondary: "secondary",
  success: "success",
  warning: "warning",
  danger: "destructive",
  default: "ghost",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      iconSize = 16,
      isLoading,
      isDisabled,
      onPress,
      onClick,
      color,
      children,
      disabled,
      startContent,
      endContent,
      ...props
    },
    ref
  ) => {
    // Map color to variant if variant not explicitly set
    const resolvedVariant = variant ?? (color ? colorToVariantMap[color] : "default");

    // Handle both onClick and onPress for compatibility
    const handleClick = onClick ?? onPress;

    // When asChild is true, Slot expects exactly one child element
    // So we pass children directly without wrapping with icons/loading
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant: resolvedVariant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant: resolvedVariant, size, className }))}
        ref={ref}
        disabled={disabled || isDisabled || isLoading}
        onClick={handleClick}
        {...props}
      >
        {isLoading && <Loader2 className="animate-spin" size={iconSize} />}
        {!isLoading && startContent}
        {!isLoading && LeftIcon && <LeftIcon size={iconSize} />}
        {children}
        {!isLoading && RightIcon && <RightIcon size={iconSize} />}
        {!isLoading && endContent}
      </button>
    );
  }
);

Button.displayName = "Button";

// IconButton variant
export interface IconButtonProps extends Omit<ButtonProps, "leftIcon" | "rightIcon" | "children"> {
  icon: LucideIcon;
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, iconSize = 18, className, size = "icon", ...props }, ref) => {
    return (
      <Button ref={ref} size={size} className={cn("min-w-0", className)} {...props}>
        <Icon size={iconSize} />
      </Button>
    );
  }
);

IconButton.displayName = "IconButton";

export { buttonVariants };
