"use client";

/**
 * useCallSession Hook
 *
 * Manages WebSocket connection for voice calls.
 * Handles audio capture, streaming, playback, and call state.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { CallStatus, CallTranscriptEntry, CallConfig } from "../components/types";

// ============================================================================
// Types
// ============================================================================

export interface UseCallSessionOptions {
  /** Chatbot ID for the call */
  chatbotId: string;
  /** Company ID */
  companyId: string;
  /** Call configuration */
  callConfig?: CallConfig;
  /** Caller name (optional) */
  callerName?: string;
  /** Caller email (optional) */
  callerEmail?: string;
  /** WebSocket URL (defaults to current origin) */
  wsUrl?: string;
  /** Sample rate for audio capture (default: 24000 for OpenAI) */
  sampleRate?: number;
  /** Called when call status changes */
  onStatusChange?: (status: CallStatus) => void;
  /** Called when a transcript entry is received */
  onTranscript?: (entry: CallTranscriptEntry) => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
}

export type ConnectionQuality = "good" | "moderate" | "poor" | "unknown";

export interface UseCallSessionReturn {
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
  error: string | null;
  /** Connection quality indicator */
  connectionQuality: ConnectionQuality;
  /** Start a call */
  startCall: () => Promise<void>;
  /** End the current call */
  endCall: () => void;
  /** Toggle mute state */
  toggleMute: () => void;
  /** Check if browser supports required APIs */
  isSupported: boolean;
}

// WebSocket event types (must match server)
const WS_EVENTS = {
  // Client → Server
  START_CALL: "start_call",
  AUDIO_DATA: "audio_data",
  END_CALL: "end_call",

  // Server → Client
  STATUS: "status",
  CALL_STARTED: "call_started",
  CALL_ENDED: "call_ended",
  AUDIO_RESPONSE: "audio_response",
  TRANSCRIPT: "transcript",
  AGENT_SPEAKING: "agent_speaking",
  AGENT_LISTENING: "agent_listening",
  STOP_AUDIO: "stop_audio",
  ERROR: "error",
  ESCALATION_STARTED: "escalation_started",
} as const;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCallSession(options: UseCallSessionOptions): UseCallSessionReturn {
  const {
    chatbotId,
    companyId,
    callConfig,
    callerName,
    callerEmail,
    wsUrl,
    sampleRate = 24000, // OpenAI default
    onStatusChange,
    onTranscript,
    onError,
  } = options;

  // State
  const [status, setStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState<CallTranscriptEntry[]>([]);
  const [audioData, setAudioData] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>("unknown");

  // Refs for WebSocket and audio context
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Reconnection refs
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIntentionalCloseRef = useRef(false);
  const MAX_RECONNECT_ATTEMPTS = 3;
  const statusRef = useRef<CallStatus>(status);

  // Quality tracking refs
  const lastAudioReceivedRef = useRef<number>(0);
  const audioReceiveCountRef = useRef<number>(0);
  const qualityCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep statusRef in sync
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Check browser support
  const isSupported = typeof window !== "undefined" &&
    "AudioContext" in window &&
    "WebSocket" in window &&
    navigator.mediaDevices?.getUserMedia !== undefined;

  /**
   * Update connection quality based on metrics
   */
  const updateConnectionQuality = useCallback(() => {
    const ws = wsRef.current;
    const now = Date.now();
    const timeSinceLastAudio = now - lastAudioReceivedRef.current;

    // Check WebSocket state
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setConnectionQuality("poor");
      return;
    }

    // Check audio buffer health
    const queueLength = audioQueueRef.current.length;
    const isPlaying = isPlayingRef.current;

    // If we haven't received audio in a while during an active call
    if (statusRef.current === "active" && lastAudioReceivedRef.current > 0) {
      if (timeSinceLastAudio > 5000) {
        // No audio for 5+ seconds - likely a problem
        setConnectionQuality("poor");
        return;
      }
      if (timeSinceLastAudio > 2000 && !isPlaying && queueLength === 0) {
        // No audio for 2+ seconds and nothing playing - moderate
        setConnectionQuality("moderate");
        return;
      }
    }

    // Check for audio queue overflow (too much buffering)
    if (queueLength > 10) {
      setConnectionQuality("moderate");
      return;
    }

    // Everything looks good
    setConnectionQuality("good");
  }, []);

  /**
   * Start quality monitoring
   */
  const startQualityMonitoring = useCallback(() => {
    // Reset metrics
    lastAudioReceivedRef.current = Date.now();
    audioReceiveCountRef.current = 0;
    setConnectionQuality("good");

    // Check quality every 2 seconds
    qualityCheckIntervalRef.current = setInterval(updateConnectionQuality, 2000);
  }, [updateConnectionQuality]);

  /**
   * Stop quality monitoring
   */
  const stopQualityMonitoring = useCallback(() => {
    if (qualityCheckIntervalRef.current) {
      clearInterval(qualityCheckIntervalRef.current);
      qualityCheckIntervalRef.current = null;
    }
    setConnectionQuality("unknown");
  }, []);

  // ============================================================================
  // Audio Processing
  // ============================================================================

  /**
   * Convert Float32 audio to PCM16 and encode as base64
   */
  const float32ToPCM16Base64 = useCallback((float32Array: Float32Array): string => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < float32Array.length; i++) {
      // Clamp and convert to 16-bit integer
      const rawSample = float32Array[i] ?? 0;
      const sample = Math.max(-1, Math.min(1, rawSample));
      view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    // Convert to base64
    const uint8 = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i] ?? 0);
    }
    return btoa(binary);
  }, []);

  /**
   * Decode base64 PCM16 to Float32
   */
  const pcm16Base64ToFloat32 = useCallback((base64: string): Float32Array => {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new DataView(buffer);

    for (let i = 0; i < binary.length; i++) {
      view.setUint8(i, binary.charCodeAt(i));
    }

    const samples = buffer.byteLength / 2;
    const float32 = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const sample = view.getInt16(i * 2, true);
      float32[i] = sample / (sample < 0 ? 0x8000 : 0x7fff);
    }

    return float32;
  }, []);

  /**
   * Play audio from queue
   */
  const playAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    const audioContext = audioContextRef.current;
    if (!audioContext || audioContext.state === "closed") {
      return;
    }

    isPlayingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const audioChunk = audioQueueRef.current.shift();
      if (!audioChunk) continue;

      const audioBuffer = audioContext.createBuffer(1, audioChunk.length, sampleRate);
      audioBuffer.getChannelData(0).set(audioChunk);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();

      // Wait for playback to complete
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
      });
    }

    isPlayingRef.current = false;
  }, [sampleRate]);

  /**
   * Update audio visualizer data
   */
  const updateVisualizerData = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) {
      animationFrameRef.current = requestAnimationFrame(updateVisualizerData);
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    setAudioData(Array.from(dataArray.slice(0, 32)));

    animationFrameRef.current = requestAnimationFrame(updateVisualizerData);
  }, []);

  // ============================================================================
  // WebSocket Handlers
  // ============================================================================

  /**
   * Send message over WebSocket
   */
  const sendMessage = useCallback((type: string, data?: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      const { type, data } = message;

      switch (type) {
        case WS_EVENTS.CALL_STARTED:
          setStatus("active");
          onStatusChange?.("active");
          // Start duration timer
          durationIntervalRef.current = setInterval(() => {
            setDuration((prev) => prev + 1);
          }, 1000);
          // Start quality monitoring
          startQualityMonitoring();
          break;

        case WS_EVENTS.CALL_ENDED:
          setStatus("ended");
          onStatusChange?.("ended");
          stopQualityMonitoring();
          break;

        case WS_EVENTS.AUDIO_RESPONSE:
          if (data?.audio) {
            // Track audio reception for quality monitoring
            lastAudioReceivedRef.current = Date.now();
            audioReceiveCountRef.current++;

            const audioChunk = pcm16Base64ToFloat32(data.audio);
            audioQueueRef.current.push(audioChunk);
            playAudioQueue();
          }
          break;

        case WS_EVENTS.TRANSCRIPT:
          if (data?.text) {
            const entry: CallTranscriptEntry = {
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              role: data.role || "assistant",
              content: data.text,
              timestamp: Date.now(),
              isFinal: data.isFinal !== false,
            };
            setTranscript((prev) => [...prev, entry]);
            onTranscript?.(entry);
          }
          break;

        case WS_EVENTS.STOP_AUDIO:
          // Clear audio queue when user interrupts
          audioQueueRef.current = [];
          isPlayingRef.current = false;
          break;

        case WS_EVENTS.ERROR:
          const errorMessage = data?.message || "An error occurred";
          setError(errorMessage);
          setStatus("error");
          onStatusChange?.("error");
          onError?.(errorMessage);
          break;

        case WS_EVENTS.ESCALATION_STARTED:
          console.log("[useCallSession] Escalation started:", data);
          setStatus("transferring");
          onStatusChange?.("transferring");
          // Add a transcript entry about the transfer
          if (data?.message) {
            const transferEntry: CallTranscriptEntry = {
              id: `${Date.now()}-transfer`,
              role: "system",
              content: data.message as string,
              timestamp: Date.now(),
              isFinal: true,
            };
            setTranscript((prev) => [...prev, transferEntry]);
            onTranscript?.(transferEntry);
          }
          break;

        case WS_EVENTS.STATUS:
          // Status update from server
          if (data?.status === "ready") {
            // Server is ready, send start call
            sendMessage(WS_EVENTS.START_CALL, {
              name: callerName,
              email: callerEmail,
            });
          }
          break;
      }
    } catch (err) {
      console.error("[useCallSession] Error parsing message:", err);
    }
  }, [callerName, callerEmail, pcm16Base64ToFloat32, playAudioQueue, onStatusChange, onTranscript, onError, sendMessage, startQualityMonitoring, stopQualityMonitoring]);

  // ============================================================================
  // Call Control Functions
  // ============================================================================

  /**
   * Start a new call
   */
  const startCall = useCallback(async () => {
    if (!isSupported) {
      const errMsg = "Browser does not support required audio APIs";
      setError(errMsg);
      onError?.(errMsg);
      return;
    }

    try {
      setStatus("connecting");
      onStatusChange?.("connecting");
      setError(null);
      setTranscript([]);
      setDuration(0);

      // Reset reconnection state for new call
      isIntentionalCloseRef.current = false;
      reconnectAttemptsRef.current = 0;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // 1. Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: sampleRate,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Create audio context
      const audioContext = new AudioContext({ sampleRate });
      audioContextRef.current = audioContext;

      // 3. Create analyser for visualizer
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // 4. Connect microphone to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // 5. Create script processor for audio capture
      // Note: ScriptProcessorNode is deprecated but AudioWorklet requires more setup
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMuted || wsRef.current?.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        const audioBase64 = float32ToPCM16Base64(inputData);

        sendMessage(WS_EVENTS.AUDIO_DATA, { audio: audioBase64 });
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // 6. Start visualizer animation
      animationFrameRef.current = requestAnimationFrame(updateVisualizerData);

      // 7. Create session and get WebSocket URL
      const sessionResponse = await fetch("/api/widget/call/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId,
          companyId,
          callerName,
          callerEmail,
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error("Failed to create call session");
      }

      const { sessionId, wsUrl: serverWsUrl } = await sessionResponse.json();
      sessionIdRef.current = sessionId;

      // 8. Connect to WebSocket
      // serverWsUrl from API already contains sessionId, so use it directly
      // Only construct URL manually if neither wsUrl nor serverWsUrl is provided
      let finalWsUrl: string;
      if (serverWsUrl) {
        finalWsUrl = serverWsUrl;
      } else if (wsUrl) {
        finalWsUrl = wsUrl.includes("sessionId=") ? wsUrl : `${wsUrl}?sessionId=${sessionId}`;
      } else {
        finalWsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/widget/call/ws?sessionId=${sessionId}`;
      }

      const ws = new WebSocket(finalWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[useCallSession] WebSocket connected");
      };

      ws.onmessage = handleMessage;

      ws.onerror = (err) => {
        console.error("[useCallSession] WebSocket error:", err);
        setError("Connection error");
        setStatus("error");
        onStatusChange?.("error");
        onError?.("Connection error");
      };

      ws.onclose = () => {
        console.log("[useCallSession] WebSocket closed");

        // If this was an intentional close, don't reconnect
        if (isIntentionalCloseRef.current) {
          if (statusRef.current !== "ended" && statusRef.current !== "error") {
            setStatus("ended");
            onStatusChange?.("ended");
          }
          return;
        }

        // Check if we should attempt to reconnect
        const currentStatus = statusRef.current;
        if (
          currentStatus === "active" &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS &&
          sessionIdRef.current
        ) {
          reconnectAttemptsRef.current++;
          const delay = Math.pow(2, reconnectAttemptsRef.current - 1) * 1000; // Exponential backoff: 1s, 2s, 4s

          console.log(
            `[useCallSession] Attempting reconnection ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`
          );

          setStatus("reconnecting");
          onStatusChange?.("reconnecting");

          reconnectTimeoutRef.current = setTimeout(() => {
            // Reconnect to WebSocket with existing session
            const wsEndpoint = wsUrl ||
              `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/widget/call/ws`;

            const newWs = new WebSocket(`${wsEndpoint}?sessionId=${sessionIdRef.current}&reconnect=true`);
            wsRef.current = newWs;

            newWs.onopen = () => {
              console.log("[useCallSession] Reconnected successfully");
              reconnectAttemptsRef.current = 0;
              setStatus("active");
              onStatusChange?.("active");
            };

            newWs.onmessage = handleMessage;

            newWs.onerror = (err) => {
              console.error("[useCallSession] Reconnection WebSocket error:", err);
            };

            // This will recursively call the same onclose handler if it fails again
            newWs.onclose = ws.onclose;
          }, delay);
        } else {
          // Max attempts reached or not in active state
          if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.log("[useCallSession] Max reconnection attempts reached");
            setError("Connection lost. Please try starting a new call.");
          }
          setStatus("ended");
          onStatusChange?.("ended");
        }
      };

    } catch (err) {
      console.error("[useCallSession] Error starting call:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to start call";
      setError(errorMessage);
      setStatus("error");
      onStatusChange?.("error");
      onError?.(errorMessage);

      // Cleanup on error
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }
  }, [
    isSupported,
    chatbotId,
    companyId,
    callerName,
    callerEmail,
    wsUrl,
    sampleRate,
    isMuted,
    status,
    float32ToPCM16Base64,
    handleMessage,
    sendMessage,
    updateVisualizerData,
    onStatusChange,
    onError,
  ]);

  /**
   * End the current call
   */
  const endCall = useCallback(() => {
    setStatus("ending");
    onStatusChange?.("ending");

    // Mark as intentional close to prevent reconnection
    isIntentionalCloseRef.current = true;

    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;

    // Send end call message
    sendMessage(WS_EVENTS.END_CALL);

    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Stop quality monitoring
    stopQualityMonitoring();

    // Stop visualizer animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop microphone
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clear audio queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    setStatus("ended");
    onStatusChange?.("ended");
  }, [sendMessage, onStatusChange, stopQualityMonitoring]);

  /**
   * Toggle mute state
   */
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);

    // Also mute/unmute the media stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // Will be toggled
      });
    }
  }, [isMuted]);

  // ============================================================================
  // Cleanup on unmount
  // ============================================================================

  useEffect(() => {
    return () => {
      // Mark as intentional close on unmount
      isIntentionalCloseRef.current = true;

      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      // Stop quality monitoring
      if (qualityCheckIntervalRef.current) {
        clearInterval(qualityCheckIntervalRef.current);
      }

      // Stop visualizer animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Stop microphone
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }

      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    status,
    isMuted,
    duration,
    transcript,
    audioData,
    error,
    connectionQuality,
    startCall,
    endCall,
    toggleMute,
    isSupported,
  };
}
