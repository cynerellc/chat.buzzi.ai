"use client";

import { cn } from "@/lib/utils";
import type { AgentInfo } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface AgentCardProps {
  agent: AgentInfo;
  /** Avatar size: xs=16px, sm=20px, md=28px */
  size?: "xs" | "sm" | "md";
  showName?: boolean;
  showDesignation?: boolean;
  isDark?: boolean;
  accentColor?: string;
  className?: string;
}

// Size mappings
const AVATAR_SIZES = {
  xs: "w-4 h-4",
  sm: "w-5 h-5",
  md: "w-7 h-7",
};

const TEXT_SIZES = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
};

const DESIGNATION_SIZES = {
  xs: "text-[8px]",
  sm: "text-[10px]",
  md: "text-xs",
};

// ============================================================================
// Component
// ============================================================================

export function AgentCard({
  agent,
  size = "md",
  showName = true,
  showDesignation = false,
  isDark = false,
  accentColor,
  className,
}: AgentCardProps) {
  const avatarBg = agent.color || accentColor || "#6437F3";
  const initial = agent.name?.charAt(0)?.toUpperCase() || "A";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* Avatar */}
      {agent.avatarUrl ? (
        <img
          src={agent.avatarUrl}
          alt={agent.name || "Agent"}
          className={cn(
            AVATAR_SIZES[size],
            "rounded-full object-cover flex-shrink-0"
          )}
        />
      ) : (
        <div
          className={cn(
            AVATAR_SIZES[size],
            "rounded-full flex items-center justify-center flex-shrink-0 text-white font-medium",
            size === "xs" && "text-[8px]",
            size === "sm" && "text-[10px]",
            size === "md" && "text-xs"
          )}
          style={{ backgroundColor: avatarBg }}
        >
          {initial}
        </div>
      )}

      {/* Name and designation */}
      {(showName || showDesignation) && (
        <div className="flex flex-col min-w-0">
          {showName && (
            <span
              className={cn(
                TEXT_SIZES[size],
                "font-medium truncate",
                isDark ? "text-white" : "text-zinc-900"
              )}
            >
              {agent.name || "Agent"}
            </span>
          )}
          {showDesignation && agent.designation && (
            <span
              className={cn(
                DESIGNATION_SIZES[size],
                "truncate",
                isDark ? "text-zinc-400" : "text-zinc-500"
              )}
            >
              {agent.designation}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
