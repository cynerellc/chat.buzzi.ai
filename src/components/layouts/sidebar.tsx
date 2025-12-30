"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Shield, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

import { sidebarExpand, smoothTransition } from "@/lib/animations";
import { cn } from "@/lib/utils";

import { Button, CountBadge, Tooltip } from "../ui";

// Sidebar context
interface SidebarContextType {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  toggleCollapse: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

// Types
export interface SidebarItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  disabled?: boolean;
}

export interface SidebarSection {
  key: string;
  title?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  logo?: ReactNode;
  logoCollapsed?: ReactNode;
  sections: SidebarSection[];
  footer?: ReactNode;
  className?: string;
}

// Corner accent component
function CornerAccent({ position }: { position: "top-left" | "top-right" | "bottom-left" | "bottom-right" }) {
  const positions = {
    "top-left": "top-2 left-2",
    "top-right": "top-2 right-2",
    "bottom-left": "bottom-2 left-2",
    "bottom-right": "bottom-2 right-2",
  };

  const lineStyles = {
    "top-left": {
      h: "top-0 left-0 w-3 h-[1px] bg-gradient-to-r from-primary/40 to-transparent",
      v: "top-0 left-0 w-[1px] h-3 bg-gradient-to-b from-primary/40 to-transparent",
    },
    "top-right": {
      h: "top-0 right-0 w-3 h-[1px] bg-gradient-to-l from-primary/40 to-transparent",
      v: "top-0 right-0 w-[1px] h-3 bg-gradient-to-b from-primary/40 to-transparent",
    },
    "bottom-left": {
      h: "bottom-0 left-0 w-3 h-[1px] bg-gradient-to-r from-primary/40 to-transparent",
      v: "bottom-0 left-0 w-[1px] h-3 bg-gradient-to-t from-primary/40 to-transparent",
    },
    "bottom-right": {
      h: "bottom-0 right-0 w-3 h-[1px] bg-gradient-to-l from-primary/40 to-transparent",
      v: "bottom-0 right-0 w-[1px] h-3 bg-gradient-to-t from-primary/40 to-transparent",
    },
  };

  return (
    <div className={cn("absolute w-4 h-4 pointer-events-none", positions[position])}>
      <div className={cn("absolute", lineStyles[position].h)} />
      <div className={cn("absolute", lineStyles[position].v)} />
    </div>
  );
}

export function Sidebar({ logo, logoCollapsed, sections, footer, className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleCollapse }}>
      <motion.aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen flex flex-col",
          "bg-background/95 backdrop-blur-xl",
          "border-r border-border/40",
          className
        )}
        variants={sidebarExpand}
        initial={false}
        animate={isCollapsed ? "collapsed" : "expanded"}
        transition={smoothTransition}
      >
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Grid pattern */}
          <div className="absolute inset-0 sidebar-grid-pattern opacity-50" />

          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-primary/[0.02]" />

          {/* Corner accents */}
          <CornerAccent position="top-left" />
          <CornerAccent position="top-right" />
          <CornerAccent position="bottom-left" />
          <CornerAccent position="bottom-right" />
        </div>

        {/* Data flow on right border (main divider) */}
        <div className="absolute right-0 inset-y-0 w-[1px] overflow-hidden pointer-events-none">
          <div
            className="w-full h-24 bg-gradient-to-b from-transparent via-primary/50 to-transparent border-data-flow-v"
            style={{ animationDelay: "1s" }}
          />
        </div>

        {/* Logo Section */}
        <div className="relative flex h-16 items-center justify-center border-b border-border/30 px-4">
          {/* Data flow on bottom border */}
          <div className="absolute inset-x-0 bottom-0 h-[1px] overflow-hidden pointer-events-none">
            <div className="h-full w-16 bg-gradient-to-r from-transparent via-primary/50 to-transparent border-data-flow-h" />
          </div>
          <AnimatePresence mode="wait">
            {isCollapsed ? (
              <motion.div
                key="collapsed"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
              >
                {logoCollapsed ?? logo}
              </motion.div>
            ) : (
              <motion.div
                key="expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="w-full"
              >
                {logo}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 overflow-y-auto py-4 px-3 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {sections.map((section, index) => (
            <div key={section.key} className={cn(index > 0 && "mt-5")}>
              {section.title && !isCollapsed && (
                <div className="flex items-center gap-2 px-3 mb-2">
                  <div className="w-1 h-1 rounded-full bg-primary/40" />
                  <h3 className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-[0.2em]">
                    {section.title}
                  </h3>
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-border/30 to-transparent" />
                </div>
              )}
              {isCollapsed && section.title && index > 0 && (
                <div className="relative h-[1px] mx-2 my-4">
                  <div className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-border/40 to-transparent" />
                  <div className="absolute left-1/2 -translate-x-1/2 -top-[2px] w-1 h-1 rounded-full bg-primary/30" />
                </div>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <SidebarNavItem
                    key={item.key}
                    item={item}
                    isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                    isCollapsed={isCollapsed}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        {footer && (
          <div className="relative border-t border-border/30 p-3">
            {/* Data flow on top border */}
            <div className="absolute inset-x-0 top-0 h-[1px] overflow-hidden pointer-events-none">
              <div
                className="h-full w-16 bg-gradient-to-r from-transparent via-primary/50 to-transparent border-data-flow-h"
                style={{ animationDelay: "2s" }}
              />
            </div>
            {footer}
          </div>
        )}

        {/* Security Status & Collapse Button */}
        <div className="relative border-t border-border/30 p-3 space-y-2">
          {/* Data flow on top border */}
          <div className="absolute inset-x-0 top-0 h-[1px] overflow-hidden pointer-events-none">
            <div
              className="h-full w-16 bg-gradient-to-r from-transparent via-primary/50 to-transparent border-data-flow-h"
              style={{ animationDelay: "4s" }}
            />
          </div>
          {/* Security indicator - only when expanded */}
          {!isCollapsed && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground/70">
              <div className="relative">
                <Shield size={12} className="text-success/70" />
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-success status-pulse" />
              </div>
              <span className="font-mono text-[10px] tracking-wide">SECURE</span>
              <div className="flex-1" />
              <span className="font-mono text-[10px] opacity-50">v2.1.0</span>
            </div>
          )}

          {/* Collapse button */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-all",
              isCollapsed && "px-2"
            )}
            onClick={toggleCollapse}
          >
            <motion.div
              animate={{ rotate: isCollapsed ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronLeft size={16} />
            </motion.div>
          </Button>
        </div>
      </motion.aside>
    </SidebarContext.Provider>
  );
}

// Individual nav item
interface SidebarNavItemProps {
  item: SidebarItem;
  isActive: boolean;
  isCollapsed: boolean;
}

function SidebarNavItem({ item, isActive, isCollapsed }: SidebarNavItemProps) {
  const content = (
    <Link
      href={item.disabled ? "#" : item.href}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2 text-[13px] font-medium transition-all duration-200",
        // Active state - minimal with left accent
        isActive
          ? "text-foreground bg-muted/50"
          : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/30",
        item.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
      )}
    >
      {/* Active indicator line */}
      {isActive && (
        <motion.div
          layoutId="activeNavIndicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-primary"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}

      {/* Icon */}
      <div className="relative">
        <item.icon
          size={18}
          strokeWidth={isActive ? 2 : 1.5}
          className={cn(
            "flex-shrink-0 transition-all duration-200",
            isActive ? "text-primary" : "text-current"
          )}
        />
        {/* Active glow */}
        {isActive && (
          <div className="absolute inset-0 bg-primary/20 blur-md" />
        )}
      </div>

      {/* Label & Badge */}
      {!isCollapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <CountBadge count={item.badge} variant="danger" />
          )}
        </>
      )}

      {/* Hover effect line */}
      {!isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 bg-primary/50 group-hover:h-3 transition-all duration-200" />
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <li>
        <Tooltip content={item.label} side="right">
          {content}
        </Tooltip>
      </li>
    );
  }

  return <li>{content}</li>;
}

// Mobile sidebar drawer
export interface MobileSidebarProps extends SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSidebar({ isOpen, onClose, ...props }: MobileSidebarProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={smoothTransition}
          >
            <div className="h-full flex flex-col bg-background border-r border-border/40">
              <Sidebar {...props} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
