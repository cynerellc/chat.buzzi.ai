"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface VoiceMessageBubbleProps {
  audioUrl: string;
  transcript: string;
  duration: number;
  isDark: boolean;
  primaryColor: string;
  bubbleColor?: string;
  isUser?: boolean;
}

/**
 * Audio player component for voice messages.
 * Shows play/pause button, progress bar, duration, and expandable transcript.
 */
export function VoiceMessageBubble({
  audioUrl,
  transcript,
  duration,
  isDark,
  primaryColor,
  bubbleColor,
  isUser = true,
}: VoiceMessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // Duration from audio metadata (may be Infinity for WebM files)
  const [metadataDuration, setMetadataDuration] = useState<number | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Use duration prop as primary source - WebM files often don't have valid duration in metadata
  // Fall back to metadata duration if available and valid
  const effectiveDuration =
    duration > 0
      ? duration
      : metadataDuration !== null && Number.isFinite(metadataDuration) && metadataDuration > 0
        ? metadataDuration
        : 0;

  // Format seconds to MM:SS, handling edge cases
  const formatTime = (seconds: number): string => {
    // Handle invalid values
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "0:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate progress percentage
  const progress = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  // Handle play/pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      setIsLoading(true);
      audioRef.current.play().catch((err) => {
        console.error("Audio playback error:", err);
        setError("Failed to play audio");
        setIsLoading(false);
      });
    }
  }, [isPlaying]);

  // Handle seek
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || effectiveDuration === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * effectiveDuration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [effectiveDuration]);

  // Set up audio element event listeners
  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      // Store the metadata duration (may be Infinity for WebM)
      // effectiveDuration will use the prop if this is invalid
      setMetadataDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleDurationChange = () => {
      // Duration may become available during playback for WebM files
      setMetadataDuration(audio.duration);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setError("Failed to load audio");
      setIsLoading(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [audioUrl, duration]);

  const backgroundColor = isUser
    ? bubbleColor || primaryColor
    : isDark
      ? "#374151"
      : "#f3f4f6";

  const textColor = isUser
    ? getContrastColor(backgroundColor)
    : isDark
      ? "#e5e7eb"
      : "#374151";

  const progressBarColor = isUser
    ? "rgba(255, 255, 255, 0.3)"
    : isDark
      ? "rgba(255, 255, 255, 0.2)"
      : "rgba(0, 0, 0, 0.1)";

  const progressFillColor = isUser
    ? "rgba(255, 255, 255, 0.9)"
    : primaryColor;

  return (
    <div
      className="rounded-2xl px-4 py-3 min-w-[200px] max-w-[280px]"
      style={{ backgroundColor }}
    >
      {/* Player row */}
      <div className="flex items-center gap-3">
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          disabled={isLoading || !!error}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all",
            "hover:scale-105 active:scale-95",
            error && "opacity-50 cursor-not-allowed"
          )}
          style={{
            backgroundColor: isUser ? "rgba(255, 255, 255, 0.2)" : primaryColor,
            color: isUser ? textColor : "#ffffff",
          }}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isLoading ? (
            <LoadingSpinner size={18} />
          ) : error ? (
            <ErrorIcon size={18} />
          ) : isPlaying ? (
            <PauseIcon size={18} />
          ) : (
            <PlayIcon size={18} />
          )}
        </button>

        {/* Progress and duration */}
        <div className="flex-1 min-w-0">
          {/* Progress bar */}
          <div
            className="h-1.5 rounded-full cursor-pointer mb-1.5"
            style={{ backgroundColor: progressBarColor }}
            onClick={handleSeek}
            role="slider"
            aria-valuenow={currentTime}
            aria-valuemin={0}
            aria-valuemax={effectiveDuration}
            tabIndex={0}
          >
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${progress}%`,
                backgroundColor: progressFillColor,
              }}
            />
          </div>

          {/* Time display - only show current time when playing or seeked */}
          <div
            className="flex justify-end text-xs"
            style={{ color: textColor, opacity: 0.8 }}
          >
            {(isPlaying || currentTime > 0) && (
              <span className="mr-auto">{formatTime(currentTime)}</span>
            )}
            <span>{formatTime(effectiveDuration)}</span>
          </div>
        </div>
      </div>

      {/* Transcript toggle */}
      {transcript && (
        <div className="mt-2 pt-2 border-t" style={{ borderColor: `${textColor}20` }}>
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="text-xs flex items-center gap-1 hover:underline"
            style={{ color: textColor, opacity: 0.7 }}
          >
            <TranscriptIcon size={12} />
            {showTranscript ? "Hide transcript" : "Show transcript"}
          </button>

          {showTranscript && (
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: textColor }}
            >
              {transcript}
            </p>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-2 text-xs" style={{ color: textColor, opacity: 0.7 }}>
          {error}
        </p>
      )}
    </div>
  );
}

// Helper to calculate contrast color
function getContrastColor(bgColor: string): string {
  const hex = bgColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

// Icons
function PlayIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
}

function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

function ErrorIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  );
}

function TranscriptIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 18h12v-2H3v2zM3 6v2h18V6H3zm0 7h18v-2H3v2z" />
    </svg>
  );
}
