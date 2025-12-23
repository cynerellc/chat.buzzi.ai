"use client";

import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  ScrollShadow,
} from "@heroui/react";
import { motion } from "framer-motion";
import { Bell, Check, MessageSquare, AlertCircle, Users, Inbox } from "lucide-react";
import { useState } from "react";

import { listItem, staggerContainer } from "@/lib/animations";
import { cn } from "@/lib/utils";

import { Button, CountBadge, IconButton, EmptyState } from "../ui";

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
  info: "text-default-500",
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
    <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
      <DropdownTrigger>
        <div className="relative cursor-pointer">
          <IconButton icon={Bell} aria-label="Notifications" variant="light" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1">
              <CountBadge count={unreadCount} />
            </span>
          )}
        </div>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Notifications"
        className="w-80"
        topContent={
          <div className="flex items-center justify-between p-3 border-b border-divider">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="light"
                leftIcon={Check}
                onPress={onMarkAllAsRead}
              >
                Mark all read
              </Button>
            )}
          </div>
        }
        bottomContent={
          notifications.length > 0 ? (
            <div className="p-2 border-t border-divider">
              <Button
                size="sm"
                variant="light"
                className="w-full"
                onPress={onViewAll}
              >
                View all notifications
              </Button>
            </div>
          ) : undefined
        }
      >
        {notifications.length === 0 ? (
          <DropdownItem key="empty" isReadOnly className="opacity-100">
            <EmptyState
              icon={Inbox}
              title="No notifications"
              description="You're all caught up!"
              size="sm"
            />
          </DropdownItem>
        ) : (
          <DropdownItem key="notifications-list" isReadOnly className="p-0">
            <ScrollShadow className="max-h-[300px]">
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
                        "py-3 px-3 cursor-pointer hover:bg-default-100 transition-colors",
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
                            <p className="text-xs text-default-500 line-clamp-2">
                              {notification.description}
                            </p>
                          )}
                          <p className="text-xs text-default-400 mt-1">
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
            </ScrollShadow>
          </DropdownItem>
        )}
      </DropdownMenu>
    </Dropdown>
  );
}
