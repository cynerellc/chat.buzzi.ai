"use client";

import { Breadcrumbs, BreadcrumbItem } from "@heroui/react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { fadeInUp, smoothTransition } from "@/lib/animations";
import { cn } from "@/lib/utils";

import { IconButton } from "../ui";

export interface BreadcrumbLink {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbLink[];
  showBack?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  showBack = false,
  onBack,
  actions,
  className,
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
      className={cn("mb-6", className)}
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={smoothTransition}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs className="mb-2">
          {breadcrumbs.map((crumb, index) => (
            <BreadcrumbItem
              key={index}
              href={crumb.href}
              isCurrent={index === breadcrumbs.length - 1}
            >
              {crumb.label}
            </BreadcrumbItem>
          ))}
        </Breadcrumbs>
      )}

      {/* Header content */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {showBack && (
            <IconButton
              icon={ArrowLeft}
              aria-label="Go back"
              variant="light"
              onPress={handleBack}
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {description && (
              <p className="text-default-500 mt-1">{description}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
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
    <h1 className={cn("text-2xl font-bold mb-6", className)}>{title}</h1>
  );
}
