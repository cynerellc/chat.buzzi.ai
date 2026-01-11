"use client";

import { cn } from "@/lib/utils";
import { humanizeToolCall } from "../utils/tool-humanizer";
import type { AgentInfo } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface ToolCallState {
  name: string;
  status: "pending" | "running" | "completed" | "error";
  args?: Record<string, unknown>;
  /** Custom notification message from tool definition */
  notification?: string;
}

export interface ThinkingBubbleProps {
  /** Current agent info */
  agent?: AgentInfo;
  /** Thinking message text */
  thinkingText?: string;
  /** Tool calls in progress */
  toolCalls?: ToolCallState[];
  /** Whether dark theme is active */
  isDark: boolean;
  /** Accent color for styling */
  accentColor?: string;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Animated thinking icon (brain with pulse effect)
 */
function ThinkingIcon({ isDark }: { isDark: boolean }) {
  return (
    <div className="relative flex items-center justify-center w-5 h-5">
      {/* Pulsing background */}
      <div
        className={cn(
          "absolute inset-0 rounded-full animate-ping opacity-20",
          isDark ? "bg-zinc-400" : "bg-zinc-600"
        )}
        style={{ animationDuration: "1.5s" }}
      />
      {/* Brain icon */}
      <svg
        className={cn(
          "w-4 h-4 relative z-10 animate-pulse",
          isDark ? "text-zinc-300" : "text-zinc-600"
        )}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        style={{ animationDuration: "1.5s" }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
        />
      </svg>
    </div>
  );
}

/**
 * Animated dots for loading state
 */
function LoadingDots({ isDark }: { isDark: boolean }) {
  return (
    <span className="inline-flex gap-0.5 ml-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "w-1 h-1 rounded-full animate-bounce",
            isDark ? "bg-zinc-400" : "bg-zinc-500"
          )}
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: "0.6s",
          }}
        />
      ))}
    </span>
  );
}

// ============================================================================
// Component
// ============================================================================

export function ThinkingBubble({
  agent,
  thinkingText,
  toolCalls,
  isDark,
  accentColor,
  className,
}: ThinkingBubbleProps) {
  // Get active tool calls (running ones)
  const activeToolCalls = toolCalls?.filter(
    (tc) => tc.status === "running" || tc.status === "pending"
  );

  // Determine what text to show
  // Priority: tool notification > humanized tool name > thinking text > default
  const firstActiveToolCall = activeToolCalls?.[0];
  const displayText =
    firstActiveToolCall
      ? (firstActiveToolCall.notification || humanizeToolCall(firstActiveToolCall.name))
      : thinkingText || "Thinking";

  return (
    <div className={cn("flex items-start gap-2 py-2", className)}>
      {/* Agent avatar (outside bubble) - aligned to top */}
      {agent && (
        <div className="flex-shrink-0">
          {agent.avatarUrl ? (
            <img
              src={agent.avatarUrl}
              alt={agent.name}
              className="h-7 w-7 rounded-full object-cover"
              style={agent.color ? { boxShadow: `0 0 0 2px ${agent.color}` } : undefined}
            />
          ) : (
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-white font-medium text-xs"
              style={{ backgroundColor: agent.color || accentColor || "#6366f1" }}
            >
              {agent.name?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 max-w-[80%]">
        {/* Agent name above bubble */}
        {agent?.name && (
          <p
            className={cn(
              "text-xs mb-1 ml-1",
              isDark ? "text-zinc-400" : "text-gray-500"
            )}
          >
            {agent.name}
          </p>
        )}

        {/* Thinking bubble */}
        <div
          className={cn(
            "px-3 py-2.5 rounded-2xl rounded-bl-sm",
            isDark
              ? "bg-zinc-800"
              : "bg-white shadow-sm"
          )}
        >
          {/* Thinking header with icon */}
          <div className="flex items-center gap-2">
            <ThinkingIcon isDark={isDark} />
            <span
              className={cn(
                "text-sm font-medium",
                isDark ? "text-zinc-200" : "text-zinc-700"
              )}
            >
              Thinking
              <LoadingDots isDark={isDark} />
            </span>
          </div>

          {/* Thinking message or tool call description */}
          {displayText && displayText !== "Thinking" && (
            <p
              className={cn(
                "mt-1.5 text-sm",
                isDark ? "text-zinc-400" : "text-zinc-500"
              )}
            >
              {displayText}
            </p>
          )}

          {/* Multiple tool calls indicator */}
          {activeToolCalls && activeToolCalls.length > 1 && (
            <p
              className={cn(
                "mt-1 text-xs",
                isDark ? "text-zinc-500" : "text-zinc-400"
              )}
            >
              +{activeToolCalls.length - 1} more{" "}
              {activeToolCalls.length - 1 === 1 ? "task" : "tasks"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
