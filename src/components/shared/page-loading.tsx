"use client";

import { Spinner } from "@heroui/react";
import { motion } from "framer-motion";

import { fadeIn } from "@/lib/animations";
import { cn } from "@/lib/utils";

export interface PageLoadingProps {
  message?: string;
  className?: string;
}

export function PageLoading({ message = "Loading...", className }: PageLoadingProps) {
  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center min-h-[400px] gap-4",
        className
      )}
      variants={fadeIn}
      initial="initial"
      animate="animate"
    >
      <Spinner size="lg" />
      <p className="text-default-500 text-sm">{message}</p>
    </motion.div>
  );
}

// Full page loading overlay
export function FullPageLoading({ message }: PageLoadingProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <PageLoading message={message} />
    </div>
  );
}

// Section loading (smaller, inline)
export interface SectionLoadingProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function SectionLoading({ className, size = "md" }: SectionLoadingProps) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <Spinner size={size} />
    </div>
  );
}
