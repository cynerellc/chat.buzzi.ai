"use client";

import {
  Breadcrumbs as HeroBreadcrumbs,
  BreadcrumbItem as HeroBreadcrumbItem,
  type BreadcrumbsProps as HeroBreadcrumbsProps,
  type BreadcrumbItemProps as HeroBreadcrumbItemProps,
} from "@heroui/react";
import { forwardRef } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

export interface BreadcrumbsProps extends Omit<HeroBreadcrumbsProps, "children"> {
  items: BreadcrumbItem[];
}

export const Breadcrumbs = forwardRef<HTMLElement, BreadcrumbsProps>(
  ({ items, className, ...props }, ref) => {
    return (
      <HeroBreadcrumbs
        ref={ref}
        className={cn(className)}
        {...props}
      >
        {items.map((item, index) => (
          <HeroBreadcrumbItem
            key={index}
            isCurrent={item.isCurrent}
          >
            {item.href && !item.isCurrent ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              item.label
            )}
          </HeroBreadcrumbItem>
        ))}
      </HeroBreadcrumbs>
    );
  }
);

Breadcrumbs.displayName = "Breadcrumbs";

// Also export the base components for custom usage
export { HeroBreadcrumbs as BreadcrumbsBase, HeroBreadcrumbItem };
export type { HeroBreadcrumbItemProps as BreadcrumbItemProps };
