"use client";

import { motion } from "framer-motion";
import { Inbox, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { fadeInUp } from "@/lib/animations";
import { cn } from "@/lib/utils";

import { Button, type ButtonProps } from "./button";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    variant?: ButtonProps["variant"];
    color?: ButtonProps["color"];
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  children,
  className,
  iconClassName,
  size = "md",
}: EmptyStateProps) {
  const sizeConfig = {
    sm: {
      icon: 32,
      iconWrapper: "w-12 h-12",
      title: "text-base",
      description: "text-sm",
      gap: "gap-3",
      padding: "py-6",
    },
    md: {
      icon: 40,
      iconWrapper: "w-16 h-16",
      title: "text-lg",
      description: "text-sm",
      gap: "gap-4",
      padding: "py-12",
    },
    lg: {
      icon: 56,
      iconWrapper: "w-20 h-20",
      title: "text-xl",
      description: "text-base",
      gap: "gap-5",
      padding: "py-16",
    },
  };

  const config = sizeConfig[size];

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        config.gap,
        config.padding,
        className
      )}
      variants={fadeInUp}
      initial="initial"
      animate="animate"
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-default-100",
          config.iconWrapper,
          iconClassName
        )}
      >
        <Icon size={config.icon} className="text-default-400" />
      </div>
      <div className="space-y-1">
        <h3 className={cn("font-semibold text-foreground", config.title)}>{title}</h3>
        {description && (
          <p className={cn("text-default-500 max-w-sm", config.description)}>{description}</p>
        )}
      </div>
      {(action || secondaryAction || children) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
          {action && (
            <Button
              color={action.color ?? "primary"}
              variant={action.variant}
              leftIcon={action.icon}
              onPress={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" onPress={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {children}
        </div>
      )}
    </motion.div>
  );
}
