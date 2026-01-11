"use client";

import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface HumanAgentInfo {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface HumanJoinedBubbleProps {
  /** Human agent who joined */
  humanAgent: HumanAgentInfo;
  /** Agent who was handling before (optional) */
  previousAgent?: { name: string; avatarUrl?: string };
  /** Whether dark theme is active */
  isDark: boolean;
  /** Accent color for styling */
  accentColor: string;
  /** Custom class name */
  className?: string;
}

export interface HumanExitedBubbleProps {
  /** Human agent who exited */
  humanAgent: HumanAgentInfo;
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

function getAccentLightColor(accentColor: string, isDark: boolean): string {
  const hex = accentColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const opacity = isDark ? 0.2 : 0.12;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// ============================================================================
// Human Joined Bubble
// ============================================================================

export function HumanJoinedBubble({
  humanAgent,
  previousAgent,
  isDark,
  accentColor,
  className,
}: HumanJoinedBubbleProps) {
  const bubbleBg = getAccentLightColor(accentColor, isDark);

  const renderAvatar = (
    agent: { name: string; avatarUrl?: string },
    isHuman = false
  ) => {
    if (agent.avatarUrl) {
      return (
        <img
          src={agent.avatarUrl}
          alt={agent.name}
          className={cn(
            "h-5 w-5 rounded-full object-cover inline align-middle mx-0.5",
            isHuman && "ring-2 ring-green-500"
          )}
        />
      );
    }
    return (
      <span
        className={cn(
          "h-5 w-5 rounded-full inline-flex items-center justify-center text-white font-medium text-[9px] align-middle mx-0.5",
          isHuman && "ring-2 ring-green-500"
        )}
        style={{ backgroundColor: accentColor }}
      >
        {agent.name?.charAt(0).toUpperCase()}
      </span>
    );
  };

  return (
    <div className={cn("flex items-start py-2", className)}>
      {/* Left spacer */}
      <div className="w-9 flex-shrink-0" />

      {/* Joined notification bubble */}
      <div
        className={cn(
          "max-w-[calc(85%-36px)] px-3 py-2 rounded-2xl text-xs leading-relaxed",
          isDark ? "text-zinc-300" : "text-zinc-600"
        )}
        style={{ backgroundColor: bubbleBg }}
      >
        

        {previousAgent && (
          <>
            <span className="font-semibold">{previousAgent.name}</span>
            {" added "}
          </>
        )}
        {renderAvatar(humanAgent )}
        <span className="font-semibold"> {humanAgent.name}</span>
         
        {" to the conversation"}
      </div>
    </div>
  );
}

// ============================================================================
// Human Exited Bubble
// ============================================================================

export function HumanExitedBubble({
  humanAgent,
  isDark,
  accentColor,
  className,
}: HumanExitedBubbleProps) {
  const bubbleBg = getAccentLightColor(accentColor, isDark);

  const renderAvatar = (agent: { name: string; avatarUrl?: string }) => {
    if (agent.avatarUrl) {
      return (
        <img
          src={agent.avatarUrl}
          alt={agent.name}
          className="h-5 w-5 rounded-full object-cover inline align-middle mx-0.5"
        />
      );
    }
    return (
      <span
        className="h-5 w-5 rounded-full inline-flex items-center justify-center text-white font-medium text-[9px] align-middle mx-0.5"
        style={{ backgroundColor: accentColor }}
      >
        {agent.name?.charAt(0).toUpperCase()}
      </span>
    );
  };

  return (
    <div className={cn("flex items-start py-2", className)}>
      {/* Left spacer */}
      <div className="w-9 flex-shrink-0" />

      {/* Exited notification bubble */}
      <div
        className={cn(
          "max-w-[calc(85%-36px)] px-3 py-2 rounded-2xl text-xs leading-relaxed",
          isDark ? "text-zinc-300" : "text-zinc-600"
        )}
        style={{ backgroundColor: bubbleBg }}
      >
        

        {renderAvatar(humanAgent)}
        <span className="font-semibold"> {humanAgent.name}</span>
        {" left the conversation. "}
        <span className={cn(isDark ? "text-zinc-400" : "text-zinc-500")}>
          AI assistant will continue helping you.
        </span>
      </div>
    </div>
  );
}
