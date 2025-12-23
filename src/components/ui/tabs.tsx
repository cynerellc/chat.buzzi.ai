"use client";

import { Tabs as HeroTabs, Tab as HeroTab, type TabsProps as HeroTabsProps } from "@heroui/react";
import { type LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type Key, useCallback } from "react";

import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  disabled?: boolean;
  content?: React.ReactNode;
}

export interface TabsProps extends Omit<HeroTabsProps, "children"> {
  items: TabItem[];
  syncWithUrl?: boolean;
  urlParam?: string;
}

export function Tabs({
  items,
  syncWithUrl = false,
  urlParam = "tab",
  className,
  selectedKey,
  onSelectionChange,
  ...props
}: TabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlSelectedKey = syncWithUrl ? searchParams.get(urlParam) ?? items[0]?.key : undefined;
  const effectiveSelectedKey = syncWithUrl ? urlSelectedKey : selectedKey;

  const handleSelectionChange = useCallback(
    (key: Key) => {
      if (syncWithUrl) {
        const params = new URLSearchParams(searchParams.toString());
        params.set(urlParam, String(key));
        router.push(`${pathname}?${params.toString()}`);
      }
      // Cast to string | number to match HeroUI's expected Key type
      onSelectionChange?.(key as string | number);
    },
    [syncWithUrl, urlParam, router, pathname, searchParams, onSelectionChange]
  );

  return (
    <HeroTabs
      className={cn(className)}
      selectedKey={effectiveSelectedKey}
      onSelectionChange={handleSelectionChange}
      {...props}
    >
      {items.map((item) => (
        <HeroTab
          key={item.key}
          isDisabled={item.disabled}
          title={
            <div className="flex items-center gap-2">
              {item.icon && <item.icon size={16} />}
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                  {item.badge}
                </span>
              )}
            </div>
          }
        >
          {item.content}
        </HeroTab>
      ))}
    </HeroTabs>
  );
}

export { HeroTab as Tab };
