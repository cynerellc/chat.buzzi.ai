"use client";

import { cn } from "@/lib/utils";
import type { AgentInfo } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface TransferBubbleProps {
  /** Previous agent (who was talking before) */
  previousAgent: AgentInfo;
  /** New agent (who just joined) */
  newAgent: AgentInfo;
  /** Whether dark theme is active */
  isDark: boolean;
  /** Accent color for styling */
  accentColor: string;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a light variant of the accent color for the bubble background
 */
function getAccentLightColor(accentColor: string, isDark: boolean): string {
  // Remove # if present
  const hex = accentColor.replace("#", "");

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Create RGBA with low opacity
  const opacity = isDark ? 0.2 : 0.12;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// ============================================================================
// Component
// ============================================================================

export function TransferBubble({
  previousAgent,
  newAgent,
  isDark,
  accentColor,
  className,
}: TransferBubbleProps) {
  const bubbleBg = getAccentLightColor(accentColor, isDark);

  // Render inline avatar like an emoji in text
  const renderAvatar = (agent: AgentInfo) => {
    if (agent.avatarUrl) {
      return (
        <img
          src={agent.avatarUrl}
          alt={agent.name}
          className="h-4 w-4 rounded-full object-cover inline align-middle mx-0.5"
        />
      );
    }
    return (
      <span
        className="h-4 w-4 rounded-full inline-flex items-center justify-center text-white font-medium text-[8px] align-middle mx-0.5"
        style={{ backgroundColor: agent.color || accentColor }}
      >
        {agent.name?.charAt(0).toUpperCase()}
      </span>
    );
  };

  return (
    <div
      className={cn(
        "flex items-start py-2",
        className
      )}
    >
      {/* Left spacer to align with agent bubble content (avatar 28px + gap 8px = 36px) */}
      <div className="w-9 flex-shrink-0" />

      {/* Transfer notification bubble - flows like paragraph text with inline avatar */}
      <div
        className={cn(
          "max-w-[calc(85%-36px)] px-3 py-1.5 rounded-2xl text-xs leading-relaxed",
          isDark ? "text-zinc-300" : "text-zinc-600"
        )}
        style={{ backgroundColor: bubbleBg }}
      >
        <span className="font-semibold">{previousAgent.name || "Agent"}</span>
        {" added "}
        {renderAvatar(newAgent)}
        <span className="font-semibold">{newAgent.name || "Agent"}</span>
        {newAgent.designation && (
          <span className={cn(isDark ? "text-zinc-400" : "text-zinc-500")}>
            {" "}({newAgent.designation})
          </span>
        )}
        {" to the conversation"}
      </div>
    </div>
  );
}
