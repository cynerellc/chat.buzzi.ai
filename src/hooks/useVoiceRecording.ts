"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface UseVoiceRecordingOptions {
  onRecordingComplete?: (blob: Blob, duration: number) => void;
  onError?: (error: string) => void;
  maxDuration?: number; // Maximum recording duration in seconds
}

export interface UseVoiceRecordingReturn {
  isRecording: boolean;
  isStarting: boolean; // True while async setup is in progress
  isSupported: boolean;
  error: string | null;
  duration: number;
  audioData: number[];
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
}

/**
 * Custom hook for push-to-talk voice recording.
 * Records audio using MediaRecorder API and returns the blob for upload.
 * Transcription is now handled server-side in the message endpoint.
 */
export function useVoiceRecording(
  options: UseVoiceRecordingOptions = {}
): UseVoiceRecordingReturn {
  const { onRecordingComplete, onError, maxDuration = 60 } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioData, setAudioData] = useState<number[]>([]);

  // Use lazy initialization to check browser support
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined"
    );
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isCancelledRef = useRef(false);
  const pendingStopRef = useRef(false);
  const mimeTypeRef = useRef<string>("audio/webm");
  const stopResolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  // Track audio energy samples for silence detection
  const energySamplesRef = useRef<number[]>([]);
  const isSilentRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const cleanupResources = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    setAudioData([]);
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      const errorMsg = "Voice recording is not supported in this browser";
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (isStarting || isRecording) {
      return; // Already starting or recording
    }

    setIsStarting(true);
    setError(null);
    pendingStopRef.current = false;
    isCancelledRef.current = false;
    energySamplesRef.current = [];
    isSilentRef.current = false;

    // Request microphone permission
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch {
      const errorMsg = "Microphone access denied. Please allow microphone access.";
      setError(errorMsg);
      onError?.(errorMsg);
      setIsStarting(false);
      return;
    }

    // Check if stop was called while we were waiting for permission
    if (pendingStopRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      setIsStarting(false);
      stopResolveRef.current?.(null);
      stopResolveRef.current = null;
      return;
    }

    // Set up audio analyser for waveform visualization
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Animation loop to get waveform data and track energy for silence detection
      const updateAudioData = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        setAudioData(Array.from(dataArray));

        // Calculate average energy for silence detection (0-255 scale)
        const avgEnergy = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        energySamplesRef.current.push(avgEnergy);

        animationFrameRef.current = requestAnimationFrame(updateAudioData);
      };
      updateAudioData();
    } catch (err) {
      console.warn("Audio visualization not available:", err);
    }

    // Create MediaRecorder for audio capture
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
    mimeTypeRef.current = mimeType;

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      cleanupResources();

      // If cancelled, don't return blob
      if (isCancelledRef.current) {
        stopResolveRef.current?.(null);
        stopResolveRef.current = null;
        return;
      }

      // Check for silence before returning blob
      // Average energy threshold: ~5 on 0-255 scale indicates silence/noise only
      const SILENCE_THRESHOLD = 5;
      if (energySamplesRef.current.length > 0) {
        const avgEnergy =
          energySamplesRef.current.reduce((sum, val) => sum + val, 0) /
          energySamplesRef.current.length;

        if (avgEnergy < SILENCE_THRESHOLD) {
          console.log(`[VoiceRecording] Silent audio detected (avgEnergy: ${avgEnergy.toFixed(2)})`);
          isSilentRef.current = true;
          const errorMsg = "No speech detected. Please speak clearly into the microphone.";
          setError(errorMsg);
          onError?.(errorMsg);
          stopResolveRef.current?.(null);
          stopResolveRef.current = null;
          return;
        }
      }

      // Create audio blob
      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
        const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        onRecordingComplete?.(audioBlob, finalDuration);
        stopResolveRef.current?.(audioBlob);
      } else {
        stopResolveRef.current?.(null);
      }
      stopResolveRef.current = null;
    };

    mediaRecorder.onerror = () => {
      const errorMsg = "Recording error occurred";
      setError(errorMsg);
      onError?.(errorMsg);
    };

    // Start recording
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100); // Collect data every 100ms
    setIsRecording(true);
    setIsStarting(false);
    setDuration(0);
    startTimeRef.current = Date.now();

    // Start duration timer
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDuration(elapsed);

      // Auto-stop if max duration reached
      if (elapsed >= maxDuration) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, 100);
  }, [isSupported, isStarting, isRecording, maxDuration, onError, onRecordingComplete, cleanupResources]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      // If still starting, mark pending stop
      if (isStarting) {
        pendingStopRef.current = true;
        stopResolveRef.current = resolve;
        return;
      }

      // If not recording, return null
      if (!isRecording || !mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      stopResolveRef.current = resolve;

      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });
  }, [isStarting, isRecording]);

  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;
    pendingStopRef.current = true;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsStarting(false);
    setDuration(0);
    setAudioData([]);
    audioChunksRef.current = [];

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    cleanupResources();

    // Resolve any pending stop promise
    stopResolveRef.current?.(null);
    stopResolveRef.current = null;
  }, [cleanupResources]);

  return {
    isRecording,
    isStarting,
    isSupported,
    error,
    duration,
    audioData,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
