"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { Message, ThinkingState } from "./types";
import { getContrastTextColor } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface AgentBubbleProps {
  /** The message to display */
  message: Message;
  /** Whether dark theme is active */
  isDark: boolean;
  /** Primary color from config */
  primaryColor: string;
  /** Whether to show multi-agent info (avatar, name) */
  isMultiAgent?: boolean;
  /** Whether to override agent color with custom color */
  overrideAgentColor?: boolean;
  /** Custom agent bubble color (when overrideAgentColor is true) */
  agentBubbleColor?: string;
  /** Whether markdown is enabled */
  enableMarkdown?: boolean;
  /** Whether this is a streaming placeholder */
  isStreamingPlaceholder?: boolean;
  /** Current thinking state (to hide typing indicator) */
  thinkingState?: ThinkingState | null;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function AgentBubble({
  message,
  isDark,
  primaryColor,
  isMultiAgent = false,
  overrideAgentColor = false,
  agentBubbleColor,
  enableMarkdown = true,
  isStreamingPlaceholder = false,
  thinkingState,
  className,
}: AgentBubbleProps) {
  const showAgentInfo = isMultiAgent && message.agentName;

  // Skip rendering the streaming placeholder when ThinkingBubble is shown
  if (isStreamingPlaceholder && thinkingState) {
    return null;
  }

  // Determine bubble background and text color
  const getBubbleStyle = () => {
    if (overrideAgentColor && agentBubbleColor) {
      return {
        backgroundColor: agentBubbleColor,
        color: getContrastTextColor(agentBubbleColor),
      };
    }
    if (message.agentColor) {
      return {
        backgroundColor: message.agentColor,
        color: getContrastTextColor(message.agentColor),
      };
    }
    return undefined;
  };

  const bubbleStyle = getBubbleStyle();
  const hasDarkBg = (() => {
    if (overrideAgentColor && agentBubbleColor) {
      return getContrastTextColor(agentBubbleColor) === "#FFFFFF";
    }
    if (message.agentColor) {
      return getContrastTextColor(message.agentColor) === "#FFFFFF";
    }
    return isDark;
  })();

  return (
    <div className={cn("flex justify-start", className)}>
      <div className={cn("max-w-[85%]", "flex gap-2")}>
        {/* Agent avatar */}
        {showAgentInfo && (
          <div className="shrink-0 pt-5">
            {message.agentAvatarUrl ? (
              <img
                src={message.agentAvatarUrl}
                alt={message.agentName}
                className="h-7 w-7 rounded-full object-cover"
                style={
                  message.agentColor
                    ? { boxShadow: `0 0 0 2px ${message.agentColor}` }
                    : undefined
                }
              />
            ) : (
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-white font-medium text-xs"
                style={{
                  backgroundColor: message.agentColor || primaryColor,
                }}
              >
                {message.agentName?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        <div>
          {/* Agent name above bubble */}
          {showAgentInfo && (
            <p
              className={cn(
                "text-xs mb-1 ml-1",
                isDark ? "text-zinc-400" : "text-gray-500"
              )}
            >
              {message.agentName}
            </p>
          )}

          {/* Message bubble */}
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 rounded-bl-sm",
              !bubbleStyle &&
                (isDark ? "bg-zinc-800" : "bg-white shadow-sm"),
              message.status === "sending" && "opacity-70"
            )}
            style={bubbleStyle}
          >
            {message.content ? (
              enableMarkdown ? (
                <div
                  className={cn(
                    "prose prose-sm max-w-none",
                    hasDarkBg && "prose-invert",
                    "[&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_pre]:my-1 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs",
                    hasDarkBg
                      ? "[&_code]:bg-white/20"
                      : "[&_code]:bg-black/10"
                  )}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )
            ) : message.status === "sending" && !thinkingState ? (
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
