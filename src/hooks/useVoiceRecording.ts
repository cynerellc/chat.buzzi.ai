"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface UseVoiceRecordingOptions {
  sessionId?: string; // Session ID for server-side transcription
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  maxDuration?: number; // Maximum recording duration in seconds
}

export interface UseVoiceRecordingReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  isSupported: boolean;
  transcript: string;
  duration: number;
  audioData: number[];
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
}

/**
 * Custom hook for push-to-talk voice recording with speech-to-text transcription.
 * Uses MediaRecorder API to record audio and sends to server for Whisper transcription.
 */
export function useVoiceRecording(
  options: UseVoiceRecordingOptions = {}
): UseVoiceRecordingReturn {
  const { sessionId, onTranscript, onError, maxDuration = 60 } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [audioData, setAudioData] = useState<number[]>([]);
  // Use lazy initialization to check browser support
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return typeof navigator.mediaDevices?.getUserMedia === "function" && typeof MediaRecorder !== "undefined";
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

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    if (!sessionId) {
      onError?.("No session ID provided for transcription");
      return;
    }

    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch(`/api/widget/${sessionId}/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Transcription failed");
      }

      const data = await response.json();
      const transcribedText = data.text?.trim();

      if (transcribedText) {
        setTranscript(transcribedText);
        onTranscript?.(transcribedText);
      }
    } catch (err) {
      console.error("Transcription error:", err);
      onError?.(err instanceof Error ? err.message : "Failed to transcribe audio");
    } finally {
      setIsTranscribing(false);
    }
  }, [sessionId, onTranscript, onError]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      onError?.("Voice recording is not supported in this browser");
      return;
    }

    // Request microphone permission
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err) {
      onError?.("Microphone access denied. Please allow microphone access.");
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

      // Animation loop to get waveform data
      const updateAudioData = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        setAudioData(Array.from(dataArray));
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

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    audioChunksRef.current = [];
    isCancelledRef.current = false;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // Clean up audio resources
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

      // If cancelled, don't transcribe
      if (isCancelledRef.current) {
        return;
      }

      // Create audio blob and send for transcription
      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await transcribeAudio(audioBlob);
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event);
      onError?.("Recording error occurred");
    };

    // Start recording
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100); // Collect data every 100ms
    setIsRecording(true);
    setTranscript("");
    setDuration(0);
    startTimeRef.current = Date.now();

    // Start duration timer
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDuration(elapsed);

      // Auto-stop if max duration reached
      if (elapsed >= maxDuration) {
        mediaRecorder.stop();
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, 100);
  }, [isSupported, maxDuration, onError, transcribeAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setTranscript("");
    setIsRecording(false);
    setDuration(0);
    setAudioData([]);
    audioChunksRef.current = [];

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Clean up audio resources
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
  }, []);

  return {
    isRecording,
    isTranscribing,
    isSupported,
    transcript,
    duration,
    audioData,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
