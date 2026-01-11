"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { Message } from "./types";
import { getContrastTextColor } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface UserBubbleProps {
  /** The message to display */
  message: Message;
  /** Whether dark theme is active */
  isDark: boolean;
  /** User bubble background color */
  userBubbleColor: string;
  /** Whether markdown is enabled */
  enableMarkdown?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function UserBubble({
  message,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isDark: _isDark,
  userBubbleColor,
  enableMarkdown = true,
  className,
}: UserBubbleProps) {
  const textColor = getContrastTextColor(userBubbleColor);
  const hasDarkBg = textColor === "#FFFFFF";

  return (
    <div className={cn("flex justify-end", className)}>
      <div className="max-w-[85%]">
        <div
          className={cn(
            "rounded-2xl rounded-br-sm px-4 py-2.5",
            message.status === "sending" && "opacity-70"
          )}
          style={{
            backgroundColor: userBubbleColor,
            color: textColor,
          }}
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
          ) : message.status === "sending" ? (
            <span className="inline-flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
