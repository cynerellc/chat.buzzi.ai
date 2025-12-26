"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Menu, Search, HelpCircle, X, Command } from "lucide-react";
import { useState, useEffect } from "react";

import { fadeIn, smoothTransition } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { IconButton, Tooltip, Input } from "@/components/ui";

import { NotificationDropdown } from "./notification-dropdown";
import { UserMenu } from "./user-menu";

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  showSearch?: boolean;
  showHelp?: boolean;
  showNotifications?: boolean;
  onMenuClick?: () => void;
  onSearch?: (query: string) => void;
  className?: string;
}

export function Header({
  title,
  subtitle,
  showSearch = true,
  showHelp = true,
  showNotifications = true,
  onMenuClick,
  onSearch,
  className,
}: HeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 lg:px-6",
        className
      )}
    >
      {/* Mobile menu button */}
      {onMenuClick && (
        <IconButton
          icon={Menu}
          aria-label="Toggle menu"
          variant="ghost"
          className="lg:hidden"
          onPress={onMenuClick}
        />
      )}

      {/* Title */}
      {title && (
        <div className="hidden sm:block">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      {showSearch && (
        <AnimatePresence mode="wait">
          {isSearchOpen ? (
            <motion.form
              key="search-input"
              className="flex items-center gap-2 flex-1 max-w-md"
              onSubmit={handleSearchSubmit}
              variants={fadeIn}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={smoothTransition}
            >
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search anything..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="pl-9 h-10 bg-muted/50 border-transparent focus:border-primary/50 focus:bg-background transition-colors"
                />
              </div>
              <IconButton
                icon={X}
                aria-label="Close search"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }}
              />
            </motion.form>
          ) : (
            <motion.div key="search-button">
              <Tooltip content="Search" shortcut="⌘K">
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="hidden md:flex items-center gap-2 h-9 px-3 text-sm text-muted-foreground bg-muted/50 hover:bg-muted border border-transparent hover:border-border/50 rounded-lg transition-all duration-200"
                >
                  <Search size={15} />
                  <span>Search...</span>
                  <kbd className="ml-2 flex items-center gap-0.5 text-[10px] text-muted-foreground/70 bg-background px-1.5 py-0.5 rounded border border-border/50">
                    <Command size={10} />K
                  </kbd>
                </button>
              </Tooltip>
              <Tooltip content="Search" shortcut="⌘K">
                <IconButton
                  icon={Search}
                  aria-label="Search"
                  variant="ghost"
                  className="md:hidden"
                  onPress={() => setIsSearchOpen(true)}
                />
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <div className="flex items-center gap-1">
        {/* Help */}
        {showHelp && (
          <Tooltip content="Help & Support">
            <IconButton
              icon={HelpCircle}
              aria-label="Help"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
            />
          </Tooltip>
        )}

        {/* Notifications */}
        {showNotifications && <NotificationDropdown />}

        {/* Divider */}
        <div className="w-px h-6 bg-border/50 mx-2" />

        {/* User menu */}
        <UserMenu />
      </div>
    </header>
  );
}
