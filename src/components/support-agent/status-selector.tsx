"use client";

import { useState, useEffect } from "react";
import { Circle, ChevronDown, Clock, Headphones, Moon, type LucideIcon } from "lucide-react";
import { Dropdown, Button, Chip } from "@/components/ui";
import type { DropdownMenuItem } from "@/components/ui";
import { cn } from "@/lib/utils";

export type AgentStatus = "online" | "away" | "busy" | "offline";

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: LucideIcon;
}

const STATUS_CONFIG: Record<AgentStatus, StatusConfig> = {
  online: {
    label: "Online",
    color: "text-success",
    bgColor: "bg-success",
    icon: Circle,
  },
  away: {
    label: "Away",
    color: "text-warning",
    bgColor: "bg-warning",
    icon: Clock,
  },
  busy: {
    label: "Busy",
    color: "text-danger",
    bgColor: "bg-danger",
    icon: Headphones,
  },
  offline: {
    label: "Offline",
    color: "text-default-400",
    bgColor: "bg-default-400",
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

  // Fetch current status on mount
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
            "gap-2 px-2",
            loading && "opacity-50 pointer-events-none",
            className
          )}
          isDisabled={loading}
        >
          <div className={cn("w-2 h-2 rounded-full", currentConfig.bgColor)} />
          {showLabel && (
            <>
              <span className={cn("text-sm", currentConfig.color)}>
                {currentConfig.label}
              </span>
              <ChevronDown size={14} className="text-default-400" />
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
    <Chip
      size="sm"
      variant="flat"
      className={cn("cursor-pointer", config.color, `bg-${config.color.replace("text-", "")}/10`)}
      startContent={<div className={cn("w-2 h-2 rounded-full", config.bgColor)} />}
    >
      {config.label}
    </Chip>
  );
}

export default StatusSelector;
