"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { Bell, MessageSquare, AlertCircle, CheckCircle, X, Settings, Inbox, ArrowRight } from "lucide-react";
import { Button, Badge, Avatar, Separator, ScrollShadow, PopoverRoot, PopoverTrigger, PopoverContent, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: "new_message" | "escalation" | "assignment" | "mention" | "system";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: {
    conversationId?: string;
    userId?: string;
    userName?: string;
    userAvatar?: string;
  };
}

export interface NotificationBadgeDropdownProps {
  className?: string;
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationBadgeDropdown({
  className,
  onNotificationClick,
}: NotificationBadgeDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: Implement actual API call
      // For now, using mock data
      setNotifications([
        {
          id: "1",
          type: "new_message",
          title: "New message",
          message: "John Doe sent a new message in conversation",
          isRead: false,
          createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          data: { conversationId: "conv-1", userName: "John Doe" },
        },
        {
          id: "2",
          type: "escalation",
          title: "Escalation alert",
          message: "A conversation has been escalated and needs attention",
          isRead: false,
          createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          data: { conversationId: "conv-2" },
        },
        {
          id: "3",
          type: "assignment",
          title: "New assignment",
          message: "You have been assigned a new conversation",
          isRead: true,
          createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          data: { conversationId: "conv-3" },
        },
      ]);
      setUnreadCount(2);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    // TODO: Call API to mark as read
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    // TODO: Call API to mark all as read
  };

  const clearNotification = async (notificationId: string) => {
    const notification = notifications.find((n) => n.id === notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    if (notification && !notification.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    // TODO: Call API to delete notification
  };

  const notificationConfig = {
    new_message: {
      icon: MessageSquare,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    escalation: {
      icon: AlertCircle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    assignment: {
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
    },
    mention: {
      icon: MessageSquare,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    system: {
      icon: Bell,
      color: "text-muted-foreground",
      bg: "bg-muted",
    },
  };

  const getNotificationConfig = (type: Notification["type"]) => {
    return notificationConfig[type] || notificationConfig.system;
  };

  return (
    <PopoverRoot
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <PopoverTrigger asChild>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative", className)}
          >
            <Bell size={20} />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-xs font-medium rounded-full flex items-center justify-center px-1"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      </PopoverTrigger>

      <PopoverContent side="bottom" align="end" sideOffset={10} className="w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5">
              <Bell size={14} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs h-8"
                  >
                    Mark all read
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings size={14} />
            </Button>
          </div>
        </div>

        {/* Notifications List */}
        <ScrollShadow className="max-h-[400px]">
          {loading ? (
            <div className="p-3 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 p-2">
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-12 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Inbox size={24} className="text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">No new notifications</p>
            </motion.div>
          ) : (
            <div className="p-2">
              <AnimatePresence>
                {notifications.map((notification, index) => {
                  const config = getNotificationConfig(notification.type);
                  const NotifIcon = config.icon;

                  return (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.03 }}
                      className={cn(
                        "relative p-3 rounded-xl mb-1 transition-all duration-200 cursor-pointer group",
                        "border border-transparent",
                        !notification.isRead
                          ? "bg-primary/5 border-primary/10"
                          : "hover:bg-muted/50 hover:border-border/50"
                      )}
                      onClick={() => {
                        markAsRead(notification.id);
                        onNotificationClick?.(notification);
                        if (notification.data?.conversationId) {
                          window.location.href = `/inbox/${notification.data.conversationId}`;
                        }
                      }}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0">
                          {notification.data?.userAvatar ? (
                            <Avatar
                              src={notification.data.userAvatar}
                              name={notification.data.userName}
                              size="sm"
                            />
                          ) : (
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center",
                              config.bg
                            )}>
                              <NotifIcon size={16} className={config.color} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{notification.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-wider">
                            {formatDistanceToNow(new Date(notification.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearNotification(notification.id);
                          }}
                        >
                          <X size={12} className="text-muted-foreground" />
                        </motion.button>
                      </div>
                      {!notification.isRead && (
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollShadow>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-2 border-t border-border/50">
            <motion.button
              whileHover={{ x: 2 }}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors group"
              onClick={() => {
                setIsOpen(false);
              }}
            >
              View all notifications
              <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </motion.button>
          </div>
        )}
      </PopoverContent>
    </PopoverRoot>
  );
}

export default NotificationBadgeDropdown;
