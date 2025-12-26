"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Circle, ChevronDown, Clock, Headphones, Moon, Check, type LucideIcon } from "lucide-react";
import { Dropdown, Button, Chip } from "@/components/ui";
import type { DropdownMenuItem } from "@/components/ui";
import { cn } from "@/lib/utils";

export type AgentStatus = "online" | "away" | "busy" | "offline";

interface StatusConfig {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  ringColor: string;
  icon: LucideIcon;
}

const STATUS_CONFIG: Record<AgentStatus, StatusConfig> = {
  online: {
    label: "Online",
    description: "Available to receive chats",
    color: "text-success",
    bgColor: "bg-success",
    ringColor: "ring-success/30",
    icon: Circle,
  },
  away: {
    label: "Away",
    description: "Temporarily unavailable",
    color: "text-warning",
    bgColor: "bg-warning",
    ringColor: "ring-warning/30",
    icon: Clock,
  },
  busy: {
    label: "Busy",
    description: "Do not disturb",
    color: "text-destructive",
    bgColor: "bg-destructive",
    ringColor: "ring-destructive/30",
    icon: Headphones,
  },
  offline: {
    label: "Offline",
    description: "Not available",
    color: "text-muted-foreground",
    bgColor: "bg-muted-foreground",
    ringColor: "ring-muted-foreground/30",
    icon: Moon,
  },
};

export interface StatusSelectorProps {
  initialStatus?: AgentStatus;
  onStatusChange?: (status: AgentStatus) => void;
  className?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function StatusSelector({
  initialStatus = "online",
  onStatusChange,
  className,
  size = "md",
  showLabel = true,
}: StatusSelectorProps) {
  const [status, setStatus] = useState<AgentStatus>(initialStatus);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/support-agent/status");
        if (response.ok) {
          const data = await response.json();
          if (data.status) {
            setStatus(data.status as AgentStatus);
          }
        }
      } catch (error) {
        console.error("Failed to fetch status:", error);
      }
    };

    fetchStatus();
  }, []);

  const handleStatusChange = async (newStatus: AgentStatus) => {
    if (newStatus === status) return;

    setLoading(true);
    try {
      const response = await fetch("/api/support-agent/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentConfig = STATUS_CONFIG[status];
  const Icon = currentConfig.icon;

  const dropdownItems: DropdownMenuItem[] = Object.entries(STATUS_CONFIG).map(
    ([key, config]) => ({
      key,
      label: config.label,
      icon: config.icon,
    })
  );

  return (
    <Dropdown
      trigger={
        <Button
          variant="ghost"
          size={size}
          className={cn(
            "gap-2.5 px-3 hover:bg-muted/50 transition-all duration-200",
            loading && "opacity-50 pointer-events-none",
            className
          )}
          isDisabled={loading}
        >
          <div className="relative">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full transition-all duration-300",
              currentConfig.bgColor,
              status === "online" && "animate-pulse"
            )} />
            <div className={cn(
              "absolute inset-0 rounded-full ring-2 animate-ping",
              currentConfig.ringColor,
              status !== "online" && "hidden"
            )} />
          </div>
          {showLabel && (
            <>
              <span className={cn("text-sm font-medium", currentConfig.color)}>
                {currentConfig.label}
              </span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </>
          )}
        </Button>
      }
      items={dropdownItems}
      onAction={(key) => handleStatusChange(key as AgentStatus)}
    />
  );
}

// Compact version for sidebar footer
export function StatusSelectorCompact({
  status = "online",
  onStatusChange,
}: {
  status?: AgentStatus;
  onStatusChange?: (status: AgentStatus) => void;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        const statuses: AgentStatus[] = ["online", "away", "busy", "offline"];
        const currentIndex = statuses.indexOf(status);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
        onStatusChange?.(nextStatus);
      }}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200",
        "hover:bg-muted/50 border border-transparent hover:border-border/50"
      )}
    >
      <div className="relative">
        <div className={cn(
          "w-2 h-2 rounded-full",
          config.bgColor,
          status === "online" && "animate-pulse"
        )} />
      </div>
      <span className={cn("text-xs font-medium", config.color)}>
        {config.label}
      </span>
    </motion.button>
  );
}

// Full status selector with description
export function StatusSelectorFull({
  status = "online",
  onStatusChange,
  className,
}: {
  status?: AgentStatus;
  onStatusChange?: (status: AgentStatus) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus: AgentStatus) => {
    if (newStatus === status) {
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/support-agent/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        onStatusChange?.(newStatus);
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  const currentConfig = STATUS_CONFIG[status];

  return (
    <div className={cn("relative", className)}>
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
          "bg-muted/30 hover:bg-muted/50 border border-border/50",
          loading && "opacity-50 pointer-events-none"
        )}
      >
        <div className="relative">
          <div className={cn(
            "w-3 h-3 rounded-full",
            currentConfig.bgColor,
            status === "online" && "animate-pulse"
          )} />
          {status === "online" && (
            <div className={cn(
              "absolute inset-0 rounded-full ring-2 animate-ping",
              currentConfig.ringColor
            )} />
          )}
        </div>
        <div className="flex-1 text-left">
          <p className={cn("text-sm font-medium", currentConfig.color)}>
            {currentConfig.label}
          </p>
          <p className="text-xs text-muted-foreground">
            {currentConfig.description}
          </p>
        </div>
        <ChevronDown size={16} className={cn(
          "text-muted-foreground transition-transform",
          isOpen && "rotate-180"
        )} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 p-2 rounded-xl bg-card border border-border shadow-lg z-50"
          >
            {(Object.entries(STATUS_CONFIG) as [AgentStatus, StatusConfig][]).map(([key, config]) => {
              const isSelected = key === status;
              const Icon = config.icon;

              return (
                <motion.button
                  key={key}
                  whileHover={{ x: 2 }}
                  onClick={() => handleStatusChange(key)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200",
                    isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    config.bgColor
                  )} />
                  <div className="flex-1 text-left">
                    <p className={cn(
                      "text-sm font-medium",
                      isSelected ? "text-primary" : config.color
                    )}>
                      {config.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {config.description}
                    </p>
                  </div>
                  {isSelected && (
                    <Check size={16} className="text-primary" />
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default StatusSelector;
