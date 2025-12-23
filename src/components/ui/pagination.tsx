"use client";

import { Pagination as HeroPagination, type PaginationProps as HeroPaginationProps } from "@heroui/react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export type PaginationProps = HeroPaginationProps;

export const Pagination = forwardRef<HTMLElement, PaginationProps>(
  ({ className, ...props }, ref) => {
    return (
      <HeroPagination
        ref={ref}
        className={cn(className)}
        {...props}
      />
    );
  }
);

Pagination.displayName = "Pagination";
