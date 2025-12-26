"use client";

import { motion } from "framer-motion";
import { Bell, Check, MessageSquare, AlertCircle, Users, Inbox } from "lucide-react";
import { useState } from "react";

import { listItem, staggerContainer } from "@/lib/animations";
import { cn } from "@/lib/utils";

import {
  Button,
  CountBadge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  EmptyState,
  IconButton,
} from "../ui";

export interface Notification {
  id: string;
  type: "message" | "alert" | "info" | "team";
  title: string;
  description?: string;
  time: string;
  read: boolean;
  href?: string;
}

const typeIcons = {
  message: MessageSquare,
  alert: AlertCircle,
  info: Bell,
  team: Users,
};

const typeColors = {
  message: "text-primary",
  alert: "text-danger",
  info: "text-muted-foreground",
  team: "text-success",
};

export interface NotificationDropdownProps {
  notifications?: Notification[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onViewAll?: () => void;
}

export function NotificationDropdown({
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onViewAll,
}: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <div className="relative cursor-pointer">
          <IconButton icon={Bell} aria-label="Notifications" variant="ghost" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1">
              <CountBadge count={unreadCount} />
            </span>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-divider">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              startContent={<Check size={14} />}
              onClick={onMarkAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* Content */}
        {notifications.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Inbox}
              title="No notifications"
              description="You're all caught up!"
              size="sm"
            />
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {notifications.map((notification) => {
                const Icon = typeIcons[notification.type];
                return (
                  <motion.div
                    key={notification.id}
                    variants={listItem}
                    className={cn(
                      "py-3 px-3 cursor-pointer hover:bg-muted transition-colors",
                      !notification.read && "bg-primary/5"
                    )}
                    onClick={() => onMarkAsRead?.(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className={cn("mt-0.5", typeColors[notification.type])}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {notification.title}
                        </p>
                        {notification.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.time}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-2 border-t border-divider">
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={onViewAll}
            >
              View all notifications
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
