"use client";

import { useRef, useEffect, useCallback, useState, FormEvent } from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface MessageInputProps {
  /** Current input value */
  value: string;
  /** Called when input value changes */
  onChange: (value: string) => void;
  /** Called when form is submitted */
  onSubmit: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether dark theme is active */
  isDark: boolean;
  /** Primary color for styling */
  primaryColor: string;
  /** Accent color for send button */
  accentColor: string;
  /** Whether currently sending a message */
  isSending?: boolean;
  /** Whether voice is enabled */
  enableVoice?: boolean;
  /** Whether voice is supported */
  isVoiceSupported?: boolean;
  /** Whether currently recording */
  isRecording?: boolean;
  /** Whether currently transcribing */
  isTranscribing?: boolean;
  /** Recording duration in seconds */
  recordingDuration?: number;
  /** Audio data for waveform visualization */
  audioData?: number[];
  /** Start recording callback */
  onStartRecording?: () => void;
  /** Stop recording callback */
  onStopRecording?: () => void;
  /** Cancel recording callback */
  onCancelRecording?: () => void;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function MessageInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Type a message...",
  isDark,
  primaryColor,
  accentColor,
  isSending = false,
  enableVoice = false,
  isVoiceSupported = false,
  isRecording = false,
  isTranscribing = false,
  recordingDuration = 0,
  audioData = [],
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  className,
}: MessageInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSubmit();
      }
    }
  };

  // Auto-resize textarea based on content (max 3 lines)
  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";

    // Calculate line height (approximately 1.5rem = 24px per line)
    const lineHeight = 24;
    const maxLines = 3;
    const maxHeight = lineHeight * maxLines;

    // Set height to scrollHeight but cap at maxHeight
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, []);

  // Adjust textarea height when input value changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [value, adjustTextareaHeight]);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "border-t p-4",
        isDark ? "border-zinc-800 bg-zinc-900" : "border-gray-200 bg-white",
        className
      )}
    >
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl px-4 py-2 transition-all",
          isDark ? "bg-zinc-800" : "bg-gray-100",
          isFocused && "ring-2"
        )}
        style={
          isFocused
            ? { ["--tw-ring-color" as string]: primaryColor }
            : undefined
        }
      >
        {/* Recording waveform - replaces textarea when recording */}
        {isRecording ? (
          <>
            {/* Audio waveform visualization */}
            <div className="flex-1 flex items-center gap-2 py-1">
              <div className="flex items-center justify-center gap-0.5 h-6 flex-1">
                {(audioData.length > 0 ? audioData.slice(0, 24) : Array(24).fill(0)).map(
                  (val, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.max(4, (val / 255) * 20)}px`,
                        backgroundColor: primaryColor,
                      }}
                    />
                  )
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium shrink-0",
                  isDark ? "text-zinc-400" : "text-gray-500"
                )}
              >
                {Math.floor(recordingDuration / 60)}:
                {(recordingDuration % 60).toString().padStart(2, "0")}
              </span>
            </div>
            {/* Cancel button */}
            <button
              type="button"
              onClick={onCancelRecording}
              className={cn(
                "rounded-full p-2 transition-colors shrink-0",
                isDark
                  ? "hover:bg-zinc-700 text-zinc-400"
                  : "hover:bg-gray-200 text-gray-500"
              )}
              aria-label="Cancel recording"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : isTranscribing ? (
          <>
            {/* Transcribing state */}
            <div className="flex-1 flex items-center gap-2 py-1">
              <div
                className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                style={{
                  borderColor: `${primaryColor} transparent transparent transparent`,
                }}
              />
              <span
                className={cn(
                  "text-sm",
                  isDark ? "text-zinc-400" : "text-gray-500"
                )}
              >
                Transcribing...
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Text input - auto-expands up to 3 lines */}
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setIsFocused(true);
              }}
              onBlur={() => {
                setIsFocused(false);
              }}
              onPaste={() => {
                // Trigger resize after paste content is applied
                setTimeout(adjustTextareaHeight, 0);
              }}
              placeholder={placeholder}
              rows={1}
              className={cn(
                "flex-1 resize-none bg-transparent py-1 overflow-y-auto",
                isDark ? "placeholder:text-zinc-500" : "placeholder:text-gray-400"
              )}
              style={{ outline: "none", border: "none", boxShadow: "none", minHeight: "24px", maxHeight: "72px" }}
            />
            {/* Processing spinner / Voice button / Send button */}
            {isSending ? (
              <div className="rounded-full p-2 shrink-0">
                <div
                  className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                  style={{
                    borderColor: `${primaryColor} transparent transparent transparent`,
                  }}
                />
              </div>
            ) : value.trim() ? (
              <button
                type="submit"
                className="rounded-full p-2 transition-colors text-white shrink-0"
                style={{ backgroundColor: accentColor }}
                aria-label="Send message"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              </button>
            ) : enableVoice && isVoiceSupported ? (
              <button
                type="button"
                onMouseDown={onStartRecording}
                onMouseUp={onStopRecording}
                onMouseLeave={onStopRecording}
                onTouchStart={onStartRecording}
                onTouchEnd={onStopRecording}
                className={cn(
                  "rounded-full p-2 transition-colors shrink-0",
                  isDark
                    ? "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700"
                    : "text-gray-500 hover:text-gray-600 hover:bg-gray-200"
                )}
                aria-label="Hold to record voice message"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </button>
            ) : null}
          </>
        )}
      </div>
    </form>
  );
}
