"use client";

import { useEffect, useCallback } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface TypingIndicatorProps {
  conversationId: string;
  className?: string;
  showLabel?: boolean;
}

interface TypingUser {
  id: string;
  name: string;
  type: "customer" | "agent";
}

export function TypingIndicator({
  conversationId,
  className,
  showLabel = true,
}: TypingIndicatorProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [typingUsers, _setTypingUsers] = useState<TypingUser[]>([]);

  // Subscribe to typing events
  useEffect(() => {
    // TODO: Implement real-time subscription
    // This would typically use WebSocket or Server-Sent Events
    // For now, this is a placeholder for the UI

    // Example: Listen for typing events
    // const unsubscribe = subscribeToTyping(conversationId, (users) => {
    //   setTypingUsers(users);
    // });
    // return () => unsubscribe();
  }, [conversationId]);

  if (typingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0]?.name ?? "Someone"} is typing`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0]?.name ?? "Someone"} and ${typingUsers[1]?.name ?? "someone"} are typing`;
    }
    return `${typingUsers.length} people are typing`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-default-500",
        className
      )}
    >
      <TypingDots />
      {showLabel && <span>{getTypingText()}</span>}
    </div>
  );
}

// Animated typing dots
export function TypingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span
        className="w-1.5 h-1.5 bg-default-400 rounded-full animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-1.5 h-1.5 bg-default-400 rounded-full animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-1.5 h-1.5 bg-default-400 rounded-full animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}

// Hook for sending typing status
export function useTypingStatus(conversationId: string) {
  const [isTyping, setIsTyping] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const sendTypingStatus = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_typing: boolean) => {
      try {
        // TODO: Implement actual API call
        // await fetch(`/api/support-agent/conversations/${conversationId}/typing`, {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify({ typing }),
        // });
      } catch (error) {
        console.error("Failed to send typing status:", error);
      }
    },
    [conversationId]
  );

  const startTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      sendTypingStatus(true);
    }

    // Reset timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Stop typing after 3 seconds of inactivity
    const newTimeoutId = setTimeout(() => {
      setIsTyping(false);
      sendTypingStatus(false);
    }, 3000);

    setTimeoutId(newTimeoutId);
  }, [isTyping, timeoutId, sendTypingStatus]);

  const stopTyping = useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (isTyping) {
      setIsTyping(false);
      sendTypingStatus(false);
    }
  }, [isTyping, timeoutId, sendTypingStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return { isTyping, startTyping, stopTyping };
}

// Typing indicator for chat bubble (shown inside message area)
export function TypingBubble({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  name: _name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="bg-content2 rounded-2xl rounded-bl-sm px-4 py-3">
        <TypingDots />
      </div>
    </div>
  );
}

export default TypingIndicator;
