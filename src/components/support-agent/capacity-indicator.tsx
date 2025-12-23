"use client";

import { useState, useEffect } from "react";
import { MessageSquare, TrendingUp, TrendingDown } from "lucide-react";
import { Progress, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";

interface CapacityData {
  currentChats: number;
  maxChats: number;
  queuedConversations: number;
}

export interface CapacityIndicatorProps {
  className?: string;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
}

export function CapacityIndicator({
  className,
  showDetails = false,
  size = "md",
}: CapacityIndicatorProps) {
  const [capacity, setCapacity] = useState<CapacityData>({
    currentChats: 0,
    maxChats: 5,
    queuedConversations: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCapacity = async () => {
      try {
        const response = await fetch("/api/support-agent/status");
        if (response.ok) {
          const data = await response.json();
          setCapacity({
            currentChats: data.currentChatCount ?? 0,
            maxChats: data.maxConcurrentChats ?? 5,
            queuedConversations: data.queuedConversations ?? 0,
          });
        }
      } catch (error) {
        console.error("Failed to fetch capacity:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCapacity();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchCapacity, 30000);
    return () => clearInterval(interval);
  }, []);

  const percentage = (capacity.currentChats / capacity.maxChats) * 100;
  const isNearCapacity = percentage >= 80;
  const isAtCapacity = percentage >= 100;

  const getProgressColor = () => {
    if (isAtCapacity) return "danger";
    if (isNearCapacity) return "warning";
    return "primary";
  };

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  if (loading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-4 bg-default-200 rounded w-24" />
      </div>
    );
  }

  return (
    <Tooltip
      content={
        <div className="p-2 text-xs space-y-1">
          <p>Active Chats: {capacity.currentChats} / {capacity.maxChats}</p>
          <p>Queue: {capacity.queuedConversations} waiting</p>
          <p className="text-default-400">
            {isAtCapacity
              ? "At capacity - finish a chat to take more"
              : isNearCapacity
              ? "Almost at capacity"
              : "Ready to take more chats"}
          </p>
        </div>
      }
    >
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1.5">
          <MessageSquare size={size === "sm" ? 12 : size === "md" ? 14 : 16} className="text-default-500" />
          <span className={cn(sizeClasses[size], "font-medium")}>
            {capacity.currentChats}/{capacity.maxChats}
          </span>
        </div>

        {showDetails && (
          <>
            <Progress
              value={percentage}
              color={getProgressColor()}
              size="sm"
              className="w-16"
            />
            {capacity.queuedConversations > 0 && (
              <span className={cn(sizeClasses[size], "text-warning")}>
                +{capacity.queuedConversations} queued
              </span>
            )}
          </>
        )}

        {!showDetails && isNearCapacity && (
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              isAtCapacity ? "bg-danger" : "bg-warning"
            )}
          />
        )}
      </div>
    </Tooltip>
  );
}

// Detailed capacity card for dashboard
export function CapacityCard({ className }: { className?: string }) {
  const [capacity, setCapacity] = useState<CapacityData & { trend: "up" | "down" | "stable" }>({
    currentChats: 0,
    maxChats: 5,
    queuedConversations: 0,
    trend: "stable",
  });

  useEffect(() => {
    const fetchCapacity = async () => {
      try {
        const response = await fetch("/api/support-agent/status");
        if (response.ok) {
          const data = await response.json();
          setCapacity({
            currentChats: data.currentChatCount ?? 0,
            maxChats: data.maxConcurrentChats ?? 5,
            queuedConversations: data.queuedConversations ?? 0,
            trend: "stable", // Could be calculated from history
          });
        }
      } catch (error) {
        console.error("Failed to fetch capacity:", error);
      }
    };

    fetchCapacity();
  }, []);

  const percentage = (capacity.currentChats / capacity.maxChats) * 100;

  return (
    <div className={cn("bg-content1 rounded-lg p-4 border border-divider", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Workload</h3>
        {capacity.trend === "up" && <TrendingUp size={16} className="text-danger" />}
        {capacity.trend === "down" && <TrendingDown size={16} className="text-success" />}
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-default-500">Active Chats</span>
            <span className="font-medium">{capacity.currentChats} / {capacity.maxChats}</span>
          </div>
          <Progress
            value={percentage}
            color={percentage >= 100 ? "danger" : percentage >= 80 ? "warning" : "primary"}
            size="md"
          />
        </div>

        {capacity.queuedConversations > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-default-500">In Queue</span>
            <span className="text-warning font-medium">{capacity.queuedConversations}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default CapacityIndicator;
