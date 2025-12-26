"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
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

export function Sidebar({ logo, logoCollapsed, sections, footer, className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleCollapse }}>
      <motion.aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-xl",
          className
        )}
        variants={sidebarExpand}
        initial={false}
        animate={isCollapsed ? "collapsed" : "expanded"}
        transition={smoothTransition}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-border/50 px-4">
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
              >
                {logo}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {sections.map((section, index) => (
            <div key={section.key} className={cn(index > 0 && "mt-6")}>
              {section.title && !isCollapsed && (
                <h3 className="px-3 mb-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                  {section.title}
                </h3>
              )}
              {isCollapsed && section.title && index > 0 && (
                <div className="h-px bg-border/50 mx-2 my-3" />
              )}
              <ul className="space-y-1">
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
          <div className="border-t border-border/50 p-3">
            {footer}
          </div>
        )}

        {/* Collapse button */}
        <div className="border-t border-border/50 p-3">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-center hover:bg-muted/80 transition-colors",
              isCollapsed && "px-2"
            )}
            onClick={toggleCollapse}
          >
            <motion.div
              animate={{ rotate: isCollapsed ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronLeft size={18} />
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
        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        item.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
      )}
    >
      <item.icon
        size={20}
        className={cn(
          "flex-shrink-0 transition-transform duration-200",
          !isActive && "group-hover:scale-110"
        )}
      />
      {!isCollapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <CountBadge count={item.badge} variant={isActive ? "default" : "danger"} />
          )}
        </>
      )}
      {isActive && !isCollapsed && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-foreground/50 rounded-r-full"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
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
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
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
            <div className="h-full flex flex-col bg-background border-r border-divider">
              <Sidebar {...props} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
