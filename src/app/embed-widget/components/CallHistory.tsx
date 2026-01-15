/**
 * CallHistory Component
 *
 * Displays a list of past calls for the user with date, duration, and status.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface CallHistoryEntry {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  endReason?: string;
  aiProvider: string;
}

interface CallHistoryProps {
  chatbotId: string;
  endUserId: string;
  primaryColor: string;
  onClose: () => void;
  className?: string;
}

export function CallHistory({
  chatbotId,
  endUserId,
  primaryColor,
  onClose,
  className,
}: CallHistoryProps) {
  const [history, setHistory] = useState<CallHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!chatbotId || !endUserId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/widget/call/history?chatbotId=${encodeURIComponent(chatbotId)}&endUserId=${encodeURIComponent(endUserId)}&limit=20`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch call history");
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error("[CallHistory] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setIsLoading(false);
    }
  }, [chatbotId, endUserId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const getStatusIcon = (status: string, endReason?: string) => {
    if (status === "completed" || endReason === "user_hangup" || endReason === "completed") {
      return (
        <svg
          className="w-4 h-4 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      );
    } else if (status === "failed" || endReason === "error") {
      return (
        <svg
          className="w-4 h-4 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      );
    }
    return (
      <svg
        className="w-4 h-4 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
        />
      </svg>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-white dark:bg-gray-900",
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700"
        style={{ backgroundColor: primaryColor }}
      >
        <h3 className="text-white font-semibold text-lg">Call History</h3>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white transition-colors p-1"
          aria-label="Close history"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div
              className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: `${primaryColor} transparent transparent transparent` }}
            />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
            <svg
              className="w-8 h-8 text-red-400 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
            <button
              onClick={fetchHistory}
              className="mt-2 text-sm font-medium hover:underline"
              style={{ color: primaryColor }}
            >
              Try again
            </button>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
            <svg
              className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No call history yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Your past calls will appear here
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {history.map((call) => (
              <li
                key={call.id}
                className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(call.status, call.endReason || undefined)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Voice Call
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDuration(call.durationSeconds)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatDate(call.startedAt)}
                    </p>
                    {call.endReason && call.endReason !== "completed" && call.endReason !== "user_hangup" && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 capitalize">
                        {call.endReason.replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      {history.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-center text-gray-400 dark:text-gray-500">
            Showing last {history.length} call{history.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
