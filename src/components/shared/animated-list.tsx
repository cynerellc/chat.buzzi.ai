"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import { type ReactNode, type Key } from "react";

import { listItem, staggerContainer, smoothTransition } from "@/lib/animations";
import { cn } from "@/lib/utils";

export interface AnimatedListProps<T> {
  items: T[];
  keyExtractor: (item: T, index: number) => Key;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  itemClassName?: string;
  variants?: Variants;
  containerVariants?: Variants;
  emptyState?: ReactNode;
}

export function AnimatedList<T>({
  items,
  keyExtractor,
  renderItem,
  className,
  itemClassName,
  variants = listItem,
  containerVariants = staggerContainer,
  emptyState,
}: AnimatedListProps<T>) {
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <motion.ul
      className={cn(className)}
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.li
            key={keyExtractor(item, index)}
            className={cn(itemClassName)}
            variants={variants}
            layout
            transition={smoothTransition}
            exit="exit"
          >
            {renderItem(item, index)}
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}

// Grid variant for card layouts
export interface AnimatedGridProps<T> extends Omit<AnimatedListProps<T>, "className" | "itemClassName"> {
  columns?: 1 | 2 | 3 | 4;
  gap?: "sm" | "md" | "lg";
  className?: string;
}

export function AnimatedGrid<T>({
  items,
  keyExtractor,
  renderItem,
  columns = 3,
  gap = "md",
  variants = listItem,
  containerVariants = staggerContainer,
  emptyState,
  className,
}: AnimatedGridProps<T>) {
  const columnClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  const gapClasses = {
    sm: "gap-3",
    md: "gap-4",
    lg: "gap-6",
  };

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <motion.div
      className={cn("grid", columnClasses[columns], gapClasses[gap], className)}
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={keyExtractor(item, index)}
            variants={variants}
            layout
            transition={smoothTransition}
            exit="exit"
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
