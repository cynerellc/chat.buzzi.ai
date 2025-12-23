"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, MessageSquare, AlertCircle, CheckCircle, X, Settings } from "lucide-react";
import { Button, Badge, Avatar, Divider, ScrollShadow } from "@/components/ui";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
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

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "new_message":
        return <MessageSquare size={16} className="text-primary" />;
      case "escalation":
        return <AlertCircle size={16} className="text-danger" />;
      case "assignment":
        return <CheckCircle size={16} className="text-success" />;
      case "mention":
        return <MessageSquare size={16} className="text-warning" />;
      default:
        return <Bell size={16} className="text-default-500" />;
    }
  };

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom-end"
      offset={10}
    >
      <PopoverTrigger>
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          className={cn("relative", className)}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-danger text-danger-foreground text-xs font-medium rounded-full flex items-center justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-divider">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                Mark all read
              </Button>
            )}
            <Button variant="ghost" size="sm" isIconOnly>
              <Settings size={16} />
            </Button>
          </div>
        </div>

        {/* Notifications List */}
        <ScrollShadow className="max-h-[400px]">
          {loading ? (
            <div className="p-4 text-center text-default-500 text-sm">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell size={32} className="mx-auto text-default-300 mb-2" />
              <p className="text-default-500 text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 hover:bg-content2 transition-colors cursor-pointer relative group",
                    !notification.isRead && "bg-primary/5"
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
                    <div className="flex-shrink-0 mt-0.5">
                      {notification.data?.userAvatar ? (
                        <Avatar
                          src={notification.data.userAvatar}
                          name={notification.data.userName}
                          size="sm"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-default-100 flex items-center justify-center">
                          {getNotificationIcon(notification.type)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-default-500 truncate">
                        {notification.message}
                      </p>
                      <p className="text-xs text-default-400 mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearNotification(notification.id);
                      }}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                  {!notification.isRead && (
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollShadow>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-2 border-t border-divider">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-primary"
              onClick={() => {
                setIsOpen(false);
                // Navigate to all notifications page if exists
              }}
            >
              View all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBadgeDropdown;
