"use client";

import { ArrowLeft, ChevronDown, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Button, CountBadge, UserAvatar } from "../ui";

/** Third-level navigation item (e.g., individual agents) */
export interface SecondaryNavThirdLevelItem {
  key: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: ReactNode;
}

/** Second-level navigation item (e.g., chatbot sections or individual chatbots) */
export interface SecondaryNavSubItem {
  key: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  /** Third-level sub-items for deeper nesting (e.g., chatbot > Agents > individual agents) */
  subItems?: SecondaryNavThirdLevelItem[];
  /** If true, section starts expanded */
  defaultExpanded?: boolean;
}

export interface SecondaryNavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  disabled?: boolean;
  /** Sub-items for collapsible sections */
  subItems?: SecondaryNavSubItem[];
  /** If true, section starts expanded */
  defaultExpanded?: boolean;
  /** Action button (e.g., "+" to add item) */
  action?: {
    icon: LucideIcon;
    href: string;
    label: string;
  };
}

export interface SecondaryNavProps {
  items: SecondaryNavItem[];
  backButton?: {
    label: string;
    href: string;
  };
  header?: {
    title: string;
    subtitle?: string;
    avatar?: string;
    statusBadge?: ReactNode;
  };
  className?: string;
}

/** Third-level navigation sub-item (deepest nesting) */
function ThirdLevelItem({
  item,
  pathname
}: {
  item: SecondaryNavThirdLevelItem;
  pathname: string;
}) {
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "group flex items-center gap-2 px-2 py-1 text-[13px] font-medium rounded-md transition-all duration-200",
          isActive
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
        )}
      >
        {item.icon && (
          <item.icon size={12} className="flex-shrink-0" />
        )}
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge}
      </Link>
    </li>
  );
}

/** Second-level navigation sub-item with optional third-level children */
function SecondLevelItem({
  item,
  pathname
}: {
  item: SecondaryNavSubItem;
  pathname: string;
}) {
  const hasSubItems = item.subItems && item.subItems.length > 0;
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const isThirdLevelActive = hasSubItems && item.subItems?.some(
    (sub) => pathname === sub.href || pathname.startsWith(`${sub.href}/`)
  );
  const [isExpanded, setIsExpanded] = useState(item.defaultExpanded ?? isThirdLevelActive ?? isActive);

  if (hasSubItems) {
    return (
      <li>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "group flex items-center gap-2 px-2 py-1.5 text-[13px] font-medium rounded-md transition-all duration-200 w-full",
            isThirdLevelActive || isActive
              ? "text-foreground bg-muted/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
        >
          {item.icon && (
            <item.icon size={14} className="flex-shrink-0" />
          )}
          <span className="flex-1 truncate text-left">{item.label}</span>
          {item.badge}
          <ChevronDown
            size={12}
            className={cn(
              "transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </button>
        {isExpanded && (
          <ul className="mt-0.5 ml-2 space-y-0.5 border-l border-border/20 pl-2">
            {item.subItems?.map((thirdItem) => (
              <ThirdLevelItem
                key={thirdItem.key}
                item={thirdItem}
                pathname={pathname}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "group flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
          isActive
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
        )}
      >
        {item.icon && (
          <item.icon size={14} className="flex-shrink-0" />
        )}
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge}
      </Link>
    </li>
  );
}

function NavItem({ item, pathname }: { item: SecondaryNavItem; pathname: string }) {
  const hasSubItems = item.subItems && item.subItems.length > 0;
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

  // Check if any sub-item or third-level item is active
  const isSubItemActive = hasSubItems && item.subItems?.some((sub) => {
    const subActive = pathname === sub.href || pathname.startsWith(`${sub.href}/`);
    const thirdLevelActive = sub.subItems?.some(
      (third) => pathname === third.href || pathname.startsWith(`${third.href}/`)
    );
    return subActive || thirdLevelActive;
  });

  const [isExpanded, setIsExpanded] = useState(item.defaultExpanded ?? isSubItemActive ?? isActive);

  if (hasSubItems) {
    return (
      <li>
        <div className="flex items-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "group relative flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-md transition-all duration-200 flex-1",
              isSubItemActive
                ? "text-foreground bg-muted"
                : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/50"
            )}
          >
            {isSubItemActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-primary rounded-full" />
            )}
            <item.icon
              size={18}
              strokeWidth={isSubItemActive ? 2 : 1.5}
              className={cn(
                "flex-shrink-0 transition-all duration-200",
                isSubItemActive ? "text-primary" : "text-current"
              )}
            />
            <span className="flex-1 truncate text-left">{item.label}</span>
            <ChevronDown
              size={14}
              className={cn(
                "transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          </button>
          {item.action && (
            <Link
              href={item.action.href}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors mr-1"
              title={item.action.label}
              onClick={(e) => e.stopPropagation()}
            >
              <item.action.icon size={14} />
            </Link>
          )}
        </div>
        {isExpanded && (
          <ul className="mt-1 ml-1 space-y-0.5   border-border/30 pl-2">
            {item.subItems?.map((subItem) => (
              <SecondLevelItem
                key={subItem.key}
                item={subItem}
                pathname={pathname}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.disabled ? "#" : item.href}
        className={cn(
          "group relative flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-md transition-all duration-200",
          isActive
            ? "text-foreground bg-muted"
            : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/50",
          item.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
        )}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-primary rounded-full" />
        )}
        <item.icon
          size={18}
          strokeWidth={isActive ? 2 : 1.5}
          className={cn(
            "flex-shrink-0 transition-all duration-200",
            isActive ? "text-primary" : "text-current"
          )}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && (
          <CountBadge count={item.badge} variant="danger" />
        )}
        {!isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 bg-primary/50 rounded-full group-hover:h-3 transition-all duration-200" />
        )}
      </Link>
    </li>
  );
}

export function SecondaryNav({ items, backButton, header, className }: SecondaryNavProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "flex flex-col w-60 shrink-0 border-r border-border/40 bg-muted/20",
        className
      )}
    >
      {/* Back Button */}
      {backButton && (
        <div className="p-3 border-b border-border/30">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground gap-2"
          >
            <Link href={backButton.href}>
              <ArrowLeft size={16} />
              <span className="truncate">{backButton.label}</span>
            </Link>
          </Button>
        </div>
      )}

      {/* Header */}
      {header && (
        <div className="p-4 border-b border-border/30">
          <div className="flex items-start gap-3">
            {header.avatar && (
              <UserAvatar
                name={header.title}
                src={header.avatar}
                size="md"
                className="shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm truncate">{header.title}</h2>
                {header.statusBadge}
              </div>
              {header.subtitle && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {header.subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        <ul className="space-y-0.5">
          {items.map((item) => (
            <NavItem key={item.key} item={item} pathname={pathname} />
          ))}
        </ul>
      </nav>
    </div>
  );
}
