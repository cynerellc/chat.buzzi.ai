"use client";

import { Input } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Search, HelpCircle, X } from "lucide-react";
import { useState } from "react";

import { fadeIn, smoothTransition } from "@/lib/animations";
import { cn } from "@/lib/utils";

import { IconButton, Tooltip } from "../ui";

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-divider bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6",
        className
      )}
    >
      {/* Mobile menu button */}
      {onMenuClick && (
        <IconButton
          icon={Menu}
          aria-label="Toggle menu"
          variant="light"
          className="lg:hidden"
          onPress={onMenuClick}
        />
      )}

      {/* Title */}
      {title && (
        <div className="hidden sm:block">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="text-xs text-default-500">{subtitle}</p>}
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
              <Input
                type="search"
                placeholder="Search..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                autoFocus
                classNames={{
                  inputWrapper: "h-9",
                }}
                startContent={<Search size={16} className="text-default-400" />}
              />
              <IconButton
                icon={X}
                aria-label="Close search"
                variant="light"
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
                <IconButton
                  icon={Search}
                  aria-label="Search"
                  variant="light"
                  onPress={() => setIsSearchOpen(true)}
                />
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Help */}
      {showHelp && (
        <Tooltip content="Help & Support">
          <IconButton icon={HelpCircle} aria-label="Help" variant="light" />
        </Tooltip>
      )}

      {/* Notifications */}
      {showNotifications && <NotificationDropdown />}

      {/* User menu */}
      <UserMenu />
    </header>
  );
}
