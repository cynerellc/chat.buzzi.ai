"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { fadeInUp, smoothTransition } from "@/lib/animations";
import { cn } from "@/lib/utils";

import { IconButton } from "../ui";

export interface PageHeaderProps {
  title: string;
  description?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export function PageHeader({
  title,
  description,
  showBack = false,
  onBack,
  actions,
  className,
  icon,
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <motion.div
      className={cn("mb-8", className)}
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={smoothTransition}
    >
      {/* Header content */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          {showBack && (
            <IconButton
              icon={ArrowLeft}
              aria-label="Go back"
              variant="ghost"
              className="mt-0.5 -ml-2 hover:bg-muted"
              onPress={handleBack}
            />
          )}
          {icon && (
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">{description}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        {actions && (
          <motion.div
            className="flex items-center gap-2 flex-shrink-0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {actions}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// Simple page title without all the features
export interface PageTitleProps {
  title: string;
  className?: string;
}

export function PageTitle({ title, className }: PageTitleProps) {
  return (
    <h1 className={cn("text-2xl sm:text-3xl font-bold tracking-tight mb-6", className)}>{title}</h1>
  );
}
