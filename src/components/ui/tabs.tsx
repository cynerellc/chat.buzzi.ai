"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { type LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  useCallback,
} from "react";

import { cn } from "@/lib/utils";

const TabsRoot = TabsPrimitive.Root;

const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-[3px] bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-[3px] px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-[1px]",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

// Legacy wrapper types and component
export interface TabItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  disabled?: boolean;
  content?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  syncWithUrl?: boolean;
  urlParam?: string;
  selectedKey?: string;
  onSelectionChange?: (key: string) => void;
  className?: string;
  variant?: "solid" | "underlined" | "bordered" | "light";
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
}

const variantClasses = {
  solid: "bg-muted",
  underlined: "bg-transparent border-b rounded-none",
  bordered: "bg-transparent border rounded-[3px]",
  light: "bg-transparent",
};

export function Tabs({
  items,
  syncWithUrl = false,
  urlParam = "tab",
  className,
  selectedKey,
  onSelectionChange,
  variant = "solid",
}: TabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlSelectedKey = syncWithUrl ? searchParams.get(urlParam) ?? items[0]?.key : undefined;
  const effectiveSelectedKey = syncWithUrl ? urlSelectedKey : selectedKey ?? items[0]?.key;

  const handleValueChange = useCallback(
    (value: string) => {
      if (syncWithUrl) {
        const params = new URLSearchParams(searchParams.toString());
        params.set(urlParam, value);
        router.push(`${pathname}?${params.toString()}`);
      }
      onSelectionChange?.(value);
    },
    [syncWithUrl, urlParam, router, pathname, searchParams, onSelectionChange]
  );

  return (
    <TabsRoot
      value={effectiveSelectedKey}
      onValueChange={handleValueChange}
      className={className}
    >
      <TabsList className={cn(variantClasses[variant])}>
        {items.map((item) => (
          <TabsTrigger
            key={item.key}
            value={item.key}
            disabled={item.disabled}
          >
            <div className="flex items-center gap-2">
              {item.icon && <item.icon size={16} />}
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                  {item.badge}
                </span>
              )}
            </div>
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) =>
        item.content ? (
          <TabsContent key={item.key} value={item.key}>
            {item.content}
          </TabsContent>
        ) : null
      )}
    </TabsRoot>
  );
}

// Export primitives
export { TabsRoot, TabsList, TabsTrigger, TabsContent };

// Legacy export
export const Tab = TabsTrigger;
