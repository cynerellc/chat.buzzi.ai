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
          "fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-divider bg-background",
          className
        )}
        variants={sidebarExpand}
        initial={false}
        animate={isCollapsed ? "collapsed" : "expanded"}
        transition={smoothTransition}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-divider px-4">
          <AnimatePresence mode="wait">
            {isCollapsed ? (
              <motion.div
                key="collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {logoCollapsed ?? logo}
              </motion.div>
            ) : (
              <motion.div
                key="expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {logo}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {sections.map((section, index) => (
            <div key={section.key} className={cn(index > 0 && "mt-6")}>
              {section.title && !isCollapsed && (
                <h3 className="px-3 mb-2 text-xs font-semibold text-default-400 uppercase tracking-wider">
                  {section.title}
                </h3>
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
          <div className="border-t border-divider p-3">
            {footer}
          </div>
        )}

        {/* Collapse button */}
        <div className="border-t border-divider p-3">
          <Button
            variant="light"
            size="sm"
            className="w-full justify-center"
            onPress={toggleCollapse}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
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
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-default-600 hover:bg-default-100 hover:text-foreground",
        item.disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <item.icon size={20} />
      {!isCollapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <CountBadge count={item.badge} color={isActive ? "default" : "danger"} />
          )}
        </>
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <li>
        <Tooltip content={item.label} placement="right">
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
