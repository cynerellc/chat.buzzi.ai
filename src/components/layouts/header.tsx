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
  pageTitle?: string;
  showSearch?: boolean;
  showHelp?: boolean;
  showNotifications?: boolean;
  onMenuClick?: () => void;
  onSearch?: (query: string) => void;
  className?: string;
}

export function Header({
  pageTitle,
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
        "sticky top-0 z-30 flex h-16 items-center gap-3",
        "bg-background/80 backdrop-blur-xl",
        "px-4 lg:px-6",
        className
      )}
    >
      {/* Bottom border that extends to touch left panel */}
      <div className="absolute bottom-0 right-0 left-0 lg:-left-64 h-[1px] bg-border/30">
        {/* Data flow animation on the border */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="h-full w-20 bg-gradient-to-r from-transparent via-primary/50 to-transparent border-data-flow-h" />
        </div>
      </div>

      {/* Mobile menu button */}
      {onMenuClick && (
        <IconButton
          icon={Menu}
          aria-label="Toggle menu"
          variant="ghost"
          className="lg:hidden text-muted-foreground"
          onPress={onMenuClick}
        />
      )}

      {/* Page Title */}
      {pageTitle && (
        <h1 className="text-sm font-medium tracking-tight text-foreground">
          {pageTitle}
        </h1>
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
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  type="search"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="pl-9 h-9 text-sm bg-muted/30 border-border/30 focus:border-primary/40 focus:bg-background/50 transition-colors"
                />
              </div>
              <IconButton
                icon={X}
                aria-label="Close search"
                variant="ghost"
                size="sm"
                className="text-muted-foreground/60"
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
                  className="hidden md:flex items-center gap-2 h-8 px-3 text-xs text-muted-foreground/70 bg-muted/20 hover:bg-muted/40 border border-border/30 hover:border-border/50 transition-all duration-200"
                >
                  <Search size={13} />
                  <span>Search...</span>
                  <kbd className="ml-2 flex items-center gap-0.5 text-[9px] text-muted-foreground/50 bg-background/50 px-1.5 py-0.5 border border-border/30 font-mono">
                    <Command size={9} />K
                  </kbd>
                </button>
              </Tooltip>
              <Tooltip content="Search" shortcut="⌘K">
                <IconButton
                  icon={Search}
                  aria-label="Search"
                  variant="ghost"
                  className="md:hidden text-muted-foreground/60"
                  onPress={() => setIsSearchOpen(true)}
                />
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-0.5">
        {/* Help */}
        {showHelp && (
          <Tooltip content="Help & Support">
            <IconButton
              icon={HelpCircle}
              aria-label="Help"
              variant="ghost"
              size="sm"
              className="text-muted-foreground/50 hover:text-muted-foreground"
            />
          </Tooltip>
        )}

        {/* Notifications */}
        {showNotifications && <NotificationDropdown />}

        {/* Divider */}
        <div className="w-[1px] h-5 bg-border/30 mx-2" />

        {/* User menu */}
        <UserMenu />
      </div>
    </header>
  );
}
