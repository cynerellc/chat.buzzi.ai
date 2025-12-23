"use client";

import { useRef, useEffect } from "react";
import { Bot, User as UserIcon, Wrench, Info } from "lucide-react";
import { ScrollShadow } from "@heroui/react";

import type { MessageItem } from "@/app/api/company/conversations/[conversationId]/messages/route";

interface MessageThreadProps {
  messages: MessageItem[];
  isLoading: boolean;
  customerName?: string | null;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }
}

function getRoleConfig(role: string) {
  switch (role) {
    case "user":
      return {
        icon: UserIcon,
        label: "Customer",
        bgColor: "bg-primary",
        textColor: "text-primary-foreground",
        align: "flex-row-reverse" as const,
      };
    case "assistant":
      return {
        icon: Bot,
        label: "AI Agent",
        bgColor: "bg-default-100",
        textColor: "text-foreground",
        align: "" as const,
      };
    case "human_agent":
      return {
        icon: UserIcon,
        label: "Human Agent",
        bgColor: "bg-secondary",
        textColor: "text-secondary-foreground",
        align: "" as const,
      };
    case "tool":
      return {
        icon: Wrench,
        label: "Tool",
        bgColor: "bg-default-50",
        textColor: "text-default-500",
        align: "" as const,
      };
    case "system":
      return {
        icon: Info,
        label: "System",
        bgColor: "bg-warning-50",
        textColor: "text-warning-700",
        align: "" as const,
      };
    default:
      return {
        icon: Bot,
        label: "Unknown",
        bgColor: "bg-default-100",
        textColor: "text-foreground",
        align: "" as const,
      };
  }
}

function groupMessagesByDate(messages: MessageItem[]): Map<string, MessageItem[]> {
  const groups = new Map<string, MessageItem[]>();

  messages.forEach((message) => {
    const dateKey = new Date(message.createdAt).toDateString();
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(message);
  });

  return groups;
}

export function MessageThread({ messages, isLoading, customerName }: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageGroups = groupMessagesByDate(messages);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-default-500">Loading messages...</div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <Bot className="h-12 w-12 text-default-300 mb-4" />
        <p className="text-default-500 font-medium">No messages yet</p>
        <p className="text-default-400 text-sm">
          Messages will appear here when the conversation starts
        </p>
      </div>
    );
  }

  return (
    <ScrollShadow className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
      <div className="space-y-6 max-w-3xl mx-auto">
        {Array.from(messageGroups.entries()).map(([dateKey, dayMessages]) => (
          <div key={dateKey}>
            {/* Date Separator */}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-divider" />
              <span className="text-xs text-default-400 font-medium">
                {formatDate(dayMessages[0]?.createdAt ?? "")}
              </span>
              <div className="flex-1 h-px bg-divider" />
            </div>

            {/* Messages for this day */}
            <div className="space-y-4">
              {dayMessages.map((message) => {
                const config = getRoleConfig(message.role);
                const Icon = config.icon;
                const displayName =
                  message.role === "user"
                    ? customerName || "Customer"
                    : message.role === "human_agent" && message.user
                      ? message.user.name || message.user.email
                      : config.label;

                return (
                  <div key={message.id} className={`flex gap-3 ${config.align}`}>
                    {/* Avatar */}
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        message.role === "user" ? "bg-primary" : "bg-default-100"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${
                          message.role === "user" ? "text-primary-foreground" : ""
                        }`}
                      />
                    </div>

                    {/* Message Content */}
                    <div className={`flex-1 ${message.role === "user" ? "text-right" : ""}`}>
                      <div
                        className={`flex items-center gap-2 mb-1 ${
                          message.role === "user" ? "justify-end" : ""
                        }`}
                      >
                        <span className="text-xs font-medium">{displayName}</span>
                        <span className="text-xs text-default-400">
                          {formatTime(message.createdAt)}
                        </span>
                      </div>

                      <div
                        className={`inline-block rounded-lg px-4 py-2 max-w-[85%] ${config.bgColor} ${config.textColor}`}
                      >
                        {message.type === "system_event" ? (
                          <p className="text-sm italic">{message.content}</p>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>

                      {/* Tool calls indicator */}
                      {message.toolCalls && (message.toolCalls as unknown[]).length > 0 && (
                        <div className="mt-1 text-xs text-default-400">
                          <Wrench className="inline h-3 w-3 mr-1" />
                          Used {(message.toolCalls as unknown[]).length} tool(s)
                        </div>
                      )}

                      {/* Token usage for AI messages */}
                      {message.role === "assistant" && message.tokenCount && (
                        <div className="mt-1 text-xs text-default-400">
                          {message.tokenCount} tokens
                          {message.processingTimeMs && ` · ${message.processingTimeMs}ms`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollShadow>
  );
}
