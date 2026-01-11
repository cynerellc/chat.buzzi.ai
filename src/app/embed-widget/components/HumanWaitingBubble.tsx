"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AgentInfo } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface HumanWaitingBubbleProps {
  /** Agent who initiated the escalation (optional) */
  initiatingAgent?: AgentInfo;
  /** Whether dark theme is active */
  isDark: boolean;
  /** Accent color for styling */
  accentColor: string;
  /** Custom class name */
  className?: string;
  /** Callback to cancel the escalation and return to AI */
  onCancelEscalation?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const WAITING_MESSAGES = [
  "Connecting you to support...",
  "Agent joining shortly...",
  "Request forwarded to team...",
  "Human agent on way...",
  "Support specialist coming soon...",
  "Team member arriving shortly...",
  "Agent being notified now...",
];

const MESSAGE_CYCLE_INTERVAL = 10000; // 10 seconds per message
const TYPEWRITER_SPEED = 30; // ms per character

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a light variant of the accent color for the bubble background
 */
function getAccentLightColor(accentColor: string, isDark: boolean): string {
  const hex = accentColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const opacity = isDark ? 0.2 : 0.12;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// ============================================================================
// Component
// ============================================================================

export function HumanWaitingBubble({
  initiatingAgent,
  isDark,
  accentColor,
  className,
  onCancelEscalation,
}: HumanWaitingBubbleProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);
  const cycleRef = useRef<NodeJS.Timeout | null>(null);

  const bubbleBg = getAccentLightColor(accentColor, isDark);
  const currentMessage = WAITING_MESSAGES[messageIndex] ?? WAITING_MESSAGES[0] ?? "";

  // Typewriter effect
  useEffect(() => {
    setDisplayedText("");
    setIsTyping(true);
    let charIndex = 0;

    const typeNextChar = () => {
      if (charIndex < currentMessage.length) {
        setDisplayedText(currentMessage.substring(0, charIndex + 1));
        charIndex++;
        typewriterRef.current = setTimeout(typeNextChar, TYPEWRITER_SPEED);
      } else {
        setIsTyping(false);
      }
    };

    typewriterRef.current = setTimeout(typeNextChar, TYPEWRITER_SPEED);

    return () => {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
      }
    };
  }, [currentMessage]);

  // Cycle through messages
  useEffect(() => {
    cycleRef.current = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % WAITING_MESSAGES.length);
    }, MESSAGE_CYCLE_INTERVAL);

    return () => {
      if (cycleRef.current) {
        clearInterval(cycleRef.current);
      }
    };
  }, []);

  return (
    <div className={cn("flex items-start py-2", className)}>
      {/* Left spacer to align with agent bubble content */}
      <div className="w-9 flex-shrink-0" />

      {/* Waiting notification bubble */}
      <div
        className={cn(
          "max-w-[calc(85%-36px)] min-w-68 px-4 py-3 rounded-2xl text-sm leading-relaxed",
          isDark ? "text-zinc-200" : "text-zinc-700"
        )}
        style={{ backgroundColor: bubbleBg }}
      >
        {/* Header with pulsing indicator */}
        <div className="flex items-center gap-2 mb-2">
          {/* Pulsing dot indicator */}
          <span className="relative flex h-2.5 w-2.5">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: accentColor }}
            />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ backgroundColor: accentColor }}
            />
          </span>
          <span
            className={cn(
              "font-medium text-xs uppercase tracking-wide",
              isDark ? "text-zinc-400" : "text-zinc-500"
            )}
          >
            Connecting to support
          </span>
        </div>

        {/* Typewriter message */}
        <div className="min-h-[1.5rem]">
          <span>{displayedText}</span>
          {isTyping && (
            <span
              className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle"
              style={{ backgroundColor: accentColor }}
            />
          )}
        </div>

        {/* Initiating agent info (if provided) */}
        {initiatingAgent && (
          <div
            className={cn(
              "flex items-center gap-2 mt-3 pt-2 border-t",
              isDark ? "border-zinc-700/50" : "border-zinc-200/50"
            )}
          >
            {initiatingAgent.avatarUrl ? (
              <img
                src={initiatingAgent.avatarUrl}
                alt={initiatingAgent.name}
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : (
              <span
                className="h-4 w-4 rounded-full inline-flex items-center justify-center text-white font-medium text-[8px]"
                style={{ backgroundColor: initiatingAgent.color || accentColor }}
              >
                {initiatingAgent.name?.charAt(0).toUpperCase()}
              </span>
            )}
            <span className={cn("text-xs", isDark ? "text-zinc-400" : "text-zinc-500")}>
              {initiatingAgent.name} escalated your request
            </span>
          </div>
        )}

        {/* Cancel escalation option */}
        {onCancelEscalation && (
          <button
            onClick={onCancelEscalation}
            className={cn(
              "mt-3 px-3 py-1.5 text-xs rounded transition-all",
              isDark
                ? "bg-zinc-700/60 text-zinc-300 hover:bg-zinc-600/80"
                : "bg-zinc-200/80 text-zinc-600 hover:bg-zinc-300"
            )}
          >
            Cancel Request
          </button>
        )}
      </div>
    </div>
  );
}
