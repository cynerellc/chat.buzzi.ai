"use client";

/**
 * CallDialog Component
 *
 * A dialog component for voice calls within the chat widget.
 * Features:
 * - Audio visualizer during active calls
 * - Live transcript display
 * - Call controls (mute, end)
 * - Call status indicators
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { CallStatus, CallTranscriptEntry, CallConfig } from "./types";
import type { ConnectionQuality } from "../hooks/useCallSession";

// ============================================================================
// Types
// ============================================================================

export interface CallDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Close the dialog */
  onClose: () => void;
  /** Start a call */
  onStartCall: () => void;
  /** End the current call */
  onEndCall: () => void;
  /** Toggle mute state */
  onToggleMute: () => void;
  /** Current call status */
  status: CallStatus;
  /** Whether microphone is muted */
  isMuted: boolean;
  /** Call duration in seconds */
  duration: number;
  /** Live transcript entries */
  transcript: CallTranscriptEntry[];
  /** Audio data for visualizer (0-255 values) */
  audioData: number[];
  /** Error message if any */
  error?: string | null;
  /** Connection quality indicator */
  connectionQuality?: ConnectionQuality;
  /** Whether dark theme is active */
  isDark: boolean;
  /** Primary color for styling */
  primaryColor: string;
  /** Call configuration */
  callConfig?: CallConfig;
  /** Agent info for display */
  agentName?: string;
  agentAvatarUrl?: string;
  /** Inline mode - renders as content without modal overlay */
  inline?: boolean;
}

// ============================================================================
// Audio Visualizer Sub-component
// ============================================================================

function AudioVisualizer({
  audioData,
  primaryColor,
  isActive,
}: {
  audioData: number[];
  primaryColor: string;
  isActive: boolean;
}) {
  const bars = 32;
  const normalizedData = audioData.length > 0 ? audioData.slice(0, bars) : Array(bars).fill(0);

  return (
    <div className="flex items-center justify-center gap-[2px] h-16 w-full">
      {normalizedData.map((val, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full transition-all duration-75"
          style={{
            height: `${Math.max(4, isActive ? (val / 255) * 60 : 4)}px`,
            backgroundColor: primaryColor,
            opacity: isActive ? 0.8 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Call Status Indicator Sub-component
// ============================================================================

function CallStatusIndicator({
  status,
  isDark,
}: {
  status: CallStatus;
  isDark: boolean;
}) {
  const statusConfig = {
    idle: { text: "Ready to call", color: "gray" },
    connecting: { text: "Connecting...", color: "yellow" },
    active: { text: "Call in progress", color: "green" },
    ending: { text: "Ending call...", color: "orange" },
    ended: { text: "Call ended", color: "gray" },
    error: { text: "Connection error", color: "red" },
    reconnecting: { text: "Reconnecting...", color: "yellow" },
    transferring: { text: "Transferring to agent...", color: "blue" },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "w-2 h-2 rounded-full",
          status === "connecting" && "animate-pulse",
          status === "active" && "animate-pulse",
          status === "transferring" && "animate-pulse"
        )}
        style={{
          backgroundColor:
            config.color === "green"
              ? "#22c55e"
              : config.color === "yellow"
              ? "#eab308"
              : config.color === "red"
              ? "#ef4444"
              : config.color === "orange"
              ? "#f97316"
              : config.color === "blue"
              ? "#3b82f6"
              : isDark
              ? "#71717a"
              : "#9ca3af",
        }}
      />
      <span
        className={cn(
          "text-sm",
          isDark ? "text-zinc-400" : "text-gray-500"
        )}
      >
        {config.text}
      </span>
    </div>
  );
}

// ============================================================================
// Connection Quality Indicator Sub-component
// ============================================================================

function ConnectionQualityIndicator({
  quality,
  isDark,
}: {
  quality: ConnectionQuality;
  isDark: boolean;
}) {
  const qualityConfig = {
    good: { label: "Good", color: "#22c55e", bars: 3 },
    moderate: { label: "Fair", color: "#eab308", bars: 2 },
    poor: { label: "Poor", color: "#ef4444", bars: 1 },
    unknown: { label: "", color: isDark ? "#71717a" : "#9ca3af", bars: 0 },
  };

  const config = qualityConfig[quality];

  // Don't show indicator if quality is unknown
  if (quality === "unknown") {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5" title={`Connection: ${config.label}`}>
      {/* Signal bars */}
      <div className="flex items-end gap-0.5 h-3">
        {[1, 2, 3].map((barNum) => (
          <div
            key={barNum}
            className="w-1 rounded-sm transition-colors"
            style={{
              height: `${(barNum / 3) * 12}px`,
              backgroundColor: barNum <= config.bars ? config.color : (isDark ? "#52525b" : "#d1d5db"),
            }}
          />
        ))}
      </div>
      {/* Label */}
      <span
        className={cn("text-xs", isDark ? "text-zinc-500" : "text-gray-400")}
      >
        {config.label}
      </span>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function CallDialog({
  isOpen,
  onClose,
  onStartCall,
  onEndCall,
  onToggleMute,
  status,
  isMuted,
  duration,
  transcript,
  audioData,
  error,
  connectionQuality,
  isDark,
  primaryColor,
  callConfig,
  agentName,
  agentAvatarUrl,
  inline = false,
}: CallDialogProps) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [showTranscript, setShowTranscript] = useState(
    callConfig?.showTranscript !== false
  );

  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (transcriptEndRef.current && showTranscript) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript, showTranscript]);

  // Format duration
  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Download transcript as text file
  const downloadTranscript = useCallback(() => {
    if (transcript.length === 0) return;

    const formattedTranscript = transcript
      .map((entry) => {
        const timestamp = new Date(entry.timestamp).toLocaleTimeString();
        const role = entry.role === "user" ? "You" : agentName || "Assistant";
        return `[${timestamp}] ${role}: ${entry.content}`;
      })
      .join("\n");

    const header = `Call Transcript - ${new Date().toLocaleString()}\n${"=".repeat(50)}\n\n`;
    const content = header + formattedTranscript;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-transcript-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [transcript, agentName]);

  if (!isOpen) return null;

  // Dialog content (shared between inline and modal modes)
  const dialogContent = (
    <>
      {/* Header */}
      <div
        className={cn(
          "px-4 py-3 border-b",
          isDark ? "border-zinc-800" : "border-gray-100"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Agent Avatar */}
            {agentAvatarUrl ? (
              <img
                src={agentAvatarUrl}
                alt={agentName || "Agent"}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: primaryColor }}
              >
                {agentName?.[0]?.toUpperCase() || "A"}
              </div>
            )}
            <div>
              <h3
                className={cn(
                  "font-medium",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                {agentName || "Voice Call"}
              </h3>
              <div className="flex items-center gap-3">
                <CallStatusIndicator status={status} isDark={isDark} />
                {status === "active" && connectionQuality && (
                  <ConnectionQualityIndicator quality={connectionQuality} isDark={isDark} />
                )}
              </div>
            </div>
          </div>

          {/* Close button (only when idle) */}
          {status === "idle" && (
            <button
              onClick={onClose}
              aria-label="Close"
              className={cn(
                "p-2 rounded-full transition-colors",
                isDark
                  ? "hover:bg-zinc-800 text-zinc-400"
                  : "hover:bg-gray-100 text-gray-500"
              )}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Audio Visualizer */}
        {callConfig?.showVisualizer !== false && (
          <div className="mb-6">
            <AudioVisualizer
              audioData={audioData}
              primaryColor={primaryColor}
              isActive={status === "active"}
            />
          </div>
        )}

        {/* Call Duration */}
        {status === "active" && (
          <div className="text-center mb-6">
            <span
              className={cn(
                "text-3xl font-mono",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {formatDuration(duration)}
            </span>
          </div>
        )}

        {/* Transcript */}
        {showTranscript && transcript.length > 0 && (
          <div
            className={cn(
              "mb-6 max-h-40 overflow-y-auto rounded-lg p-3",
              isDark ? "bg-zinc-800" : "bg-gray-50"
            )}
          >
            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "mb-2 last:mb-0",
                  entry.role === "user" ? "text-right" : "text-left"
                )}
              >
                <span
                  className={cn(
                    "inline-block px-3 py-1.5 rounded-lg text-sm",
                    entry.role === "user"
                      ? isDark
                        ? "bg-zinc-700 text-white"
                        : "bg-gray-200 text-gray-900"
                      : isDark
                      ? "text-zinc-300"
                      : "text-gray-700",
                    !entry.isFinal && "opacity-70"
                  )}
                  style={
                    entry.role === "assistant"
                      ? { backgroundColor: `${primaryColor}20` }
                      : undefined
                  }
                >
                  {entry.content}
                </span>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {status === "idle" ? (
            /* Start Call Button */
            <button
              onClick={onStartCall}
              aria-label="Start Call"
              className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: primaryColor }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          ) : (
            <>
              {/* Mute Button */}
              <button
                onClick={onToggleMute}
                aria-label={isMuted ? "Unmute" : "Mute"}
                disabled={status !== "active"}
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                  isDark
                    ? isMuted
                      ? "bg-red-500/20 text-red-400"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    : isMuted
                    ? "bg-red-100 text-red-600"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  status !== "active" && "opacity-50 cursor-not-allowed"
                )}
              >
                {isMuted ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <line x1="1" x2="23" y1="1" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                )}
              </button>

              {/* End Call Button */}
              <button
                onClick={onEndCall}
                aria-label="End call"
                disabled={status === "ending" || status === "ended"}
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center bg-red-500 text-white shadow-lg transition-transform",
                  status === "ending" || status === "ended"
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:scale-105 active:scale-95 hover:bg-red-600"
                )}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                  <line x1="23" x2="1" y1="1" y2="23" />
                </svg>
              </button>

              {/* Toggle Transcript Button */}
              {callConfig?.showTranscript !== false && (
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                    isDark
                      ? showTranscript
                        ? "bg-zinc-700 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      : showTranscript
                      ? "bg-gray-200 text-gray-900"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className={cn(
          "px-4 py-3 text-center",
          isDark ? "text-zinc-500" : "text-gray-400"
        )}
      >
        {status === "idle" && (
          <span className="text-xs">Tap the button to start a voice call</span>
        )}
        {status === "connecting" && (
          <span className="text-xs">Please wait while we connect...</span>
        )}
        {status === "reconnecting" && (
          <span className="text-xs">Connection lost. Attempting to reconnect...</span>
        )}
        {status === "active" && (
          <span className="text-xs">Speak clearly into your microphone</span>
        )}
        {status === "transferring" && (
          <span className="text-xs">Please wait while we connect you to a human agent...</span>
        )}
        {status === "ended" && transcript.length > 0 && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs">Call ended</span>
            <button
              onClick={downloadTranscript}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                isDark
                  ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                Download Transcript
              </div>
            </button>
          </div>
        )}
      </div>
    </>
  );

  // Inline mode: render as content without modal overlay
  if (inline) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-2xl",
          isDark ? "bg-zinc-900" : "bg-white"
        )}
      >
        {dialogContent}
      </div>
    );
  }

  // Modal mode: render with backdrop overlay
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "animate-in fade-in duration-200"
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={status === "idle" ? onClose : undefined}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-dialog-title"
        className={cn(
          "relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden",
          "animate-in zoom-in-95 duration-200",
          isDark ? "bg-zinc-900" : "bg-white"
        )}
      >
        {dialogContent}
      </div>
    </div>
  );
}
