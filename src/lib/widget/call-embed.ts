/**
 * Call Widget Embed Script
 *
 * This is the entry point for the embeddable voice call widget.
 * Provides real-time voice call functionality via WebSocket connection.
 *
 * Features:
 * - Floating call button (orb/pill style)
 * - Audio capture via getUserMedia
 * - WebSocket connection for audio streaming
 * - Real-time transcription display
 * - Audio visualizer
 */

// ============================================================================
// Types
// ============================================================================

export interface CallWidgetConfig {
  // Required
  chatbotId: string;
  companyId: string;

  // Call settings
  position?: "bottom-right" | "bottom-left";
  buttonStyle?: "orb" | "pill";
  buttonSize?: number;
  primaryColor?: string;
  showVisualizer?: boolean;
  showTranscript?: boolean;

  // Customer info (optional)
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    metadata?: Record<string, unknown>;
  };

  // Callbacks
  onCallStart?: () => void;
  onCallEnd?: (reason?: string) => void;
  onTranscript?: (data: TranscriptData) => void;
  onError?: (error: Error) => void;
}

export interface TranscriptData {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isFinal?: boolean;
}

export type CallState = "idle" | "connecting" | "active" | "muted" | "ended";

export type CallEventType =
  | "stateChange"
  | "transcript"
  | "audioLevel"
  | "error";

export type CallEventCallback<T = unknown> = (data: T) => void;

export interface CallWidgetAPI {
  startCall(): Promise<void>;
  endCall(): void;
  mute(): void;
  unmute(): void;
  toggleMute(): void;
  isMuted(): boolean;
  getState(): CallState;
  destroy(): void;
  on<T = unknown>(event: CallEventType, callback: CallEventCallback<T>): void;
  off<T = unknown>(event: CallEventType, callback: CallEventCallback<T>): void;
}

declare global {
  interface Window {
    CALL_WIDGET_CONFIG?: CallWidgetConfig;
    CallWidget?: CallWidgetAPI;
  }
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: Partial<CallWidgetConfig> = {
  position: "bottom-right",
  buttonStyle: "orb",
  buttonSize: 60,
  primaryColor: "#6437F3",
  showVisualizer: true,
  showTranscript: true,
};

// Audio settings
const SAMPLE_RATE = 24000; // OpenAI Realtime expects 24kHz
const BUFFER_SIZE = 4096;
const CHANNELS = 1;

// ============================================================================
// SVG Icons
// ============================================================================

function createSvgElement(
  tag: string,
  attrs: Record<string, string>
): SVGElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

function createPhoneIcon(): SVGElement {
  const svg = createSvgElement("svg", {
    width: "28",
    height: "28",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "white",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  const path = createSvgElement("path", {
    d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
  });
  svg.appendChild(path);
  return svg;
}

function createPhoneOffIcon(): SVGElement {
  const svg = createSvgElement("svg", {
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "white",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  const path1 = createSvgElement("path", {
    d: "M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67",
  });
  const path2 = createSvgElement("path", {
    d: "M22 2 2 22",
  });
  const path3 = createSvgElement("path", {
    d: "M8.09 9.91A19.5 19.5 0 0 1 3.19 4.05 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11l-.28.28",
  });
  svg.appendChild(path1);
  svg.appendChild(path2);
  svg.appendChild(path3);
  return svg;
}

function createMicIcon(): SVGElement {
  const svg = createSvgElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  const rect = createSvgElement("rect", {
    x: "9",
    y: "2",
    width: "6",
    height: "11",
    rx: "3",
  });
  const path = createSvgElement("path", {
    d: "M19 10v2a7 7 0 0 1-14 0v-2",
  });
  const line = createSvgElement("line", {
    x1: "12",
    y1: "19",
    x2: "12",
    y2: "23",
  });
  const line2 = createSvgElement("line", {
    x1: "8",
    y1: "23",
    x2: "16",
    y2: "23",
  });
  svg.appendChild(rect);
  svg.appendChild(path);
  svg.appendChild(line);
  svg.appendChild(line2);
  return svg;
}

function createMicOffIcon(): SVGElement {
  const svg = createSvgElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  const line = createSvgElement("line", {
    x1: "1",
    y1: "1",
    x2: "23",
    y2: "23",
  });
  const path = createSvgElement("path", {
    d: "M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6",
  });
  const path2 = createSvgElement("path", {
    d: "M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23",
  });
  const line2 = createSvgElement("line", {
    x1: "12",
    y1: "19",
    x2: "12",
    y2: "23",
  });
  const line3 = createSvgElement("line", {
    x1: "8",
    y1: "23",
    x2: "16",
    y2: "23",
  });
  svg.appendChild(line);
  svg.appendChild(path);
  svg.appendChild(path2);
  svg.appendChild(line2);
  svg.appendChild(line3);
  return svg;
}

// ============================================================================
// Call Widget Class
// ============================================================================

class BuzziCallWidget implements CallWidgetAPI {
  private config: CallWidgetConfig;
  private baseUrl: string;

  // DOM elements
  private container: HTMLDivElement | null = null;
  private launcher: HTMLButtonElement | null = null;
  private dialog: HTMLDivElement | null = null;

  // Audio context
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;

  // WebSocket
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;

  // State
  private state: CallState = "idle";
  private isMutedState = false;
  private transcripts: TranscriptData[] = [];

  // Event listeners
  private eventListeners: Map<CallEventType, Set<CallEventCallback>> = new Map();

  // Animation
  private animationFrameId: number | null = null;

  constructor(config: CallWidgetConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baseUrl = this.getBaseUrl();
    this.init();
  }

  private getBaseUrl(): string {
    const scriptEl = document.querySelector('script[src*="call.min.js"]');
    if (scriptEl) {
      const src = scriptEl.getAttribute("src") ?? "";
      try {
        const url = new URL(src);
        return `${url.protocol}//${url.host}`;
      } catch {
        // Relative URL, use current origin
      }
    }
    return window.location.origin;
  }

  private async init(): Promise<void> {
    // Validate required fields
    if (!this.config.chatbotId || !this.config.companyId) {
      console.error("BuzziCallWidget: chatbotId and companyId are required");
      return;
    }

    // Create container
    this.container = document.createElement("div");
    this.container.id = "buzzi-call-widget";
    this.container.style.cssText = `
      position: fixed;
      bottom: 0;
      ${this.config.position === "bottom-left" ? "left: 0" : "right: 0"};
      z-index: 999998;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create launcher button
    this.launcher = this.createLauncher();
    this.container.appendChild(this.launcher);

    // Append to body
    document.body.appendChild(this.container);

    // Expose global API
    window.CallWidget = this;
  }

  private createLauncher(): HTMLButtonElement {
    const launcher = document.createElement("button");
    launcher.id = "buzzi-call-launcher";
    launcher.setAttribute("aria-label", "Start voice call");

    const size = this.config.buttonSize ?? 60;
    const color = this.config.primaryColor ?? "#6437F3";
    const isOrb = this.config.buttonStyle === "orb";

    launcher.style.cssText = `
      width: ${isOrb ? size : size * 2}px;
      height: ${size}px;
      border-radius: ${isOrb ? "50%" : `${size / 2}px`};
      border: none;
      background: ${color};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 20px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      position: relative;
      overflow: hidden;
    `;

    // Add phone icon
    launcher.appendChild(createPhoneIcon());

    // Add label for pill style
    if (!isOrb) {
      const label = document.createElement("span");
      label.textContent = "Call";
      label.style.cssText = `
        color: white;
        font-weight: 500;
        font-size: 14px;
      `;
      launcher.appendChild(label);
    }

    // Hover effects
    launcher.addEventListener("mouseenter", () => {
      launcher.style.transform = "scale(1.05)";
      launcher.style.boxShadow = "0 6px 32px rgba(0, 0, 0, 0.2)";
    });

    launcher.addEventListener("mouseleave", () => {
      launcher.style.transform = "scale(1)";
      launcher.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.15)";
    });

    // Click handler
    launcher.addEventListener("click", () => {
      if (this.state === "idle") {
        this.startCall();
      } else {
        this.endCall();
      }
    });

    return launcher;
  }

  private createCallDialog(): HTMLDivElement {
    const dialog = document.createElement("div");
    dialog.id = "buzzi-call-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "Voice call");

    const position = this.config.position ?? "bottom-right";
    const color = this.config.primaryColor ?? "#6437F3";

    dialog.style.cssText = `
      position: absolute;
      bottom: 90px;
      ${position === "bottom-left" ? "left: 20px" : "right: 20px"};
      width: 360px;
      max-height: 500px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    `;

    // Header
    const header = document.createElement("div");
    header.style.cssText = `
      padding: 16px;
      background: ${color};
      color: white;
      text-align: center;
    `;

    const title = document.createElement("div");
    title.id = "buzzi-call-status";
    title.textContent = "Connecting...";
    title.style.cssText = `
      font-weight: 600;
      font-size: 16px;
    `;

    const duration = document.createElement("div");
    duration.id = "buzzi-call-duration";
    duration.textContent = "00:00";
    duration.style.cssText = `
      font-size: 14px;
      opacity: 0.9;
      margin-top: 4px;
    `;

    header.appendChild(title);
    header.appendChild(duration);

    // Visualizer
    const visualizerContainer = document.createElement("div");
    visualizerContainer.id = "buzzi-call-visualizer";
    visualizerContainer.style.cssText = `
      height: 60px;
      padding: 8px 16px;
      background: #f5f5f5;
      display: ${this.config.showVisualizer !== false ? "flex" : "none"};
      align-items: center;
      justify-content: center;
    `;

    const canvas = document.createElement("canvas");
    canvas.id = "buzzi-call-visualizer-canvas";
    canvas.width = 300;
    canvas.height = 40;
    canvas.style.cssText = `
      width: 100%;
      height: 100%;
    `;
    visualizerContainer.appendChild(canvas);

    // Transcript area
    const transcriptArea = document.createElement("div");
    transcriptArea.id = "buzzi-call-transcript";
    transcriptArea.style.cssText = `
      flex: 1;
      min-height: 200px;
      max-height: 300px;
      overflow-y: auto;
      padding: 16px;
      display: ${this.config.showTranscript !== false ? "flex" : "none"};
      flex-direction: column;
      gap: 12px;
    `;

    // Controls
    const controls = document.createElement("div");
    controls.style.cssText = `
      display: flex;
      justify-content: center;
      gap: 16px;
      padding: 16px;
      border-top: 1px solid #eee;
    `;

    // Mute button
    const muteBtn = document.createElement("button");
    muteBtn.id = "buzzi-call-mute";
    muteBtn.setAttribute("aria-label", "Mute microphone");
    muteBtn.style.cssText = `
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: none;
      background: #f0f0f0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;
    `;
    muteBtn.appendChild(createMicIcon());
    muteBtn.addEventListener("click", () => this.toggleMute());
    muteBtn.addEventListener("mouseenter", () => {
      muteBtn.style.background = "#e0e0e0";
    });
    muteBtn.addEventListener("mouseleave", () => {
      muteBtn.style.background = this.isMutedState ? "#ffebee" : "#f0f0f0";
    });

    // End call button
    const endBtn = document.createElement("button");
    endBtn.id = "buzzi-call-end";
    endBtn.setAttribute("aria-label", "End call");
    endBtn.style.cssText = `
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: none;
      background: #f44336;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;
    `;
    endBtn.appendChild(createPhoneOffIcon());
    endBtn.addEventListener("click", () => this.endCall());
    endBtn.addEventListener("mouseenter", () => {
      endBtn.style.background = "#d32f2f";
    });
    endBtn.addEventListener("mouseleave", () => {
      endBtn.style.background = "#f44336";
    });

    controls.appendChild(muteBtn);
    controls.appendChild(endBtn);

    dialog.appendChild(header);
    dialog.appendChild(visualizerContainer);
    dialog.appendChild(transcriptArea);
    dialog.appendChild(controls);

    return dialog;
  }

  private updateState(newState: CallState): void {
    const prevState = this.state;
    this.state = newState;
    this.emit("stateChange", { previousState: prevState, currentState: newState });

    // Update UI
    this.updateLauncherState();
    this.updateDialogState();
  }

  private updateLauncherState(): void {
    if (!this.launcher) return;

    const color = this.config.primaryColor ?? "#6437F3";

    switch (this.state) {
      case "connecting":
        this.launcher.style.background = "#ffc107";
        this.launcher.style.animation = "pulse 1.5s infinite";
        break;
      case "active":
      case "muted":
        this.launcher.style.background = "#4caf50";
        this.launcher.style.animation = "none";
        break;
      case "idle":
      case "ended":
      default:
        this.launcher.style.background = color;
        this.launcher.style.animation = "none";
        break;
    }
  }

  private updateDialogState(): void {
    const statusEl = document.getElementById("buzzi-call-status");
    if (!statusEl) return;

    switch (this.state) {
      case "connecting":
        statusEl.textContent = "Connecting...";
        break;
      case "active":
        statusEl.textContent = "Call Active";
        break;
      case "muted":
        statusEl.textContent = "Muted";
        break;
      case "ended":
        statusEl.textContent = "Call Ended";
        break;
      default:
        statusEl.textContent = "Ready";
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  async startCall(): Promise<void> {
    if (this.state !== "idle") {
      console.warn("Call already in progress");
      return;
    }

    try {
      this.updateState("connecting");

      // Show dialog
      if (!this.dialog && this.container) {
        this.dialog = this.createCallDialog();
        this.container.appendChild(this.dialog);
        requestAnimationFrame(() => {
          if (this.dialog) {
            this.dialog.style.opacity = "1";
            this.dialog.style.transform = "translateY(0)";
          }
        });
      }

      // Request microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: CHANNELS,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Setup audio context
      this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create analyser for visualizer
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      // Create script processor for capturing audio
      this.scriptProcessor = this.audioContext.createScriptProcessor(
        BUFFER_SIZE,
        CHANNELS,
        CHANNELS
      );

      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      // Create call session
      const sessionResponse = await fetch(`${this.baseUrl}/api/widget/call/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId: this.config.chatbotId,
          companyId: this.config.companyId,
          callerInfo: this.config.customer,
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error("Failed to create call session");
      }

      const { sessionId, wsUrl } = await sessionResponse.json();
      this.sessionId = sessionId;

      // Connect WebSocket
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("Call WebSocket connected");
        this.updateState("active");
        this.startDurationTimer();
        this.startVisualizerAnimation();
        this.config.onCallStart?.();
      };

      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.ws.onerror = (error) => {
        console.error("Call WebSocket error:", error);
        this.emit("error", new Error("WebSocket connection error"));
        this.config.onError?.(new Error("Connection error"));
      };

      this.ws.onclose = () => {
        console.log("Call WebSocket closed");
        if (this.state !== "ended") {
          this.endCall("connection_closed");
        }
      };

      // Send audio data
      this.scriptProcessor.onaudioprocess = (event) => {
        if (this.ws?.readyState === WebSocket.OPEN && !this.isMutedState) {
          const inputData = event.inputBuffer.getChannelData(0);
          const pcm16 = this.float32ToPCM16(inputData);
          const base64 = this.arrayBufferToBase64(pcm16.buffer);

          this.ws.send(JSON.stringify({
            type: "audio_data",
            data: { audio: base64 },
          }));
        }
      };
    } catch (error) {
      console.error("Failed to start call:", error);
      this.updateState("idle");
      this.emit("error", error);
      this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  endCall(reason?: string): void {
    // Update state
    this.updateState("ended");

    // Stop audio
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.send(JSON.stringify({ type: "end_call", data: { reason } }));
      this.ws.close();
      this.ws = null;
    }

    // Stop animations
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Hide dialog after delay
    if (this.dialog) {
      this.dialog.style.opacity = "0";
      this.dialog.style.transform = "translateY(20px)";
      setTimeout(() => {
        if (this.dialog && this.container) {
          this.container.removeChild(this.dialog);
          this.dialog = null;
        }
      }, 200);
    }

    // Reset state after delay
    setTimeout(() => {
      this.updateState("idle");
      this.transcripts = [];
      this.isMutedState = false;
    }, 500);

    this.config.onCallEnd?.(reason);
  }

  mute(): void {
    this.isMutedState = true;
    this.updateState("muted");
    this.updateMuteButton();
  }

  unmute(): void {
    this.isMutedState = false;
    this.updateState("active");
    this.updateMuteButton();
  }

  toggleMute(): void {
    if (this.isMutedState) {
      this.unmute();
    } else {
      this.mute();
    }
  }

  isMuted(): boolean {
    return this.isMutedState;
  }

  getState(): CallState {
    return this.state;
  }

  destroy(): void {
    this.endCall("destroyed");

    if (this.container) {
      document.body.removeChild(this.container);
      this.container = null;
    }

    this.launcher = null;
    delete window.CallWidget;
  }

  on<T = unknown>(event: CallEventType, callback: CallEventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback as CallEventCallback);
  }

  off<T = unknown>(event: CallEventType, callback: CallEventCallback<T>): void {
    this.eventListeners.get(event)?.delete(callback as CallEventCallback);
  }

  private emit<T = unknown>(event: CallEventType, data: T): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "audio_response":
          this.playAudio(message.data.audio);
          break;

        case "transcript":
          this.addTranscript(message.data);
          break;

        case "state_change":
          if (message.data.state === "listening") {
            // Agent is listening
          } else if (message.data.state === "speaking") {
            // Agent is speaking
          }
          break;

        case "error":
          console.error("Call error:", message.data);
          this.emit("error", new Error(message.data.message));
          break;

        case "call_ended":
          this.endCall(message.data?.reason);
          break;
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  private async playAudio(base64Audio: string): Promise<void> {
    if (!this.audioContext) return;

    try {
      const pcm16 = this.base64ToArrayBuffer(base64Audio);
      const float32 = this.pcm16ToFloat32(new Int16Array(pcm16));

      const audioBuffer = this.audioContext.createBuffer(
        CHANNELS,
        float32.length,
        SAMPLE_RATE
      );
      audioBuffer.getChannelData(0).set(float32);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.error("Failed to play audio:", error);
    }
  }

  private addTranscript(data: TranscriptData): void {
    this.transcripts.push(data);
    this.emit("transcript", data);
    this.config.onTranscript?.(data);

    // Update UI
    const container = document.getElementById("buzzi-call-transcript");
    if (!container) return;

    const bubble = document.createElement("div");
    const isUser = data.role === "user";

    bubble.style.cssText = `
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.4;
      ${isUser ? `
        align-self: flex-end;
        background: ${this.config.primaryColor ?? "#6437F3"};
        color: white;
        border-bottom-right-radius: 4px;
      ` : `
        align-self: flex-start;
        background: #f0f0f0;
        color: #333;
        border-bottom-left-radius: 4px;
      `}
    `;
    bubble.textContent = data.content;

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  }

  private updateMuteButton(): void {
    const muteBtn = document.getElementById("buzzi-call-mute");
    if (!muteBtn) return;

    // Clear existing icon
    while (muteBtn.firstChild) {
      muteBtn.removeChild(muteBtn.firstChild);
    }

    // Add appropriate icon
    if (this.isMutedState) {
      muteBtn.appendChild(createMicOffIcon());
      muteBtn.style.background = "#ffebee";
      muteBtn.setAttribute("aria-label", "Unmute microphone");
    } else {
      muteBtn.appendChild(createMicIcon());
      muteBtn.style.background = "#f0f0f0";
      muteBtn.setAttribute("aria-label", "Mute microphone");
    }
  }

  private startDurationTimer(): void {
    const startTime = Date.now();
    const durationEl = document.getElementById("buzzi-call-duration");

    const updateDuration = () => {
      if (this.state !== "active" && this.state !== "muted") return;

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
      const seconds = (elapsed % 60).toString().padStart(2, "0");

      if (durationEl) {
        durationEl.textContent = `${minutes}:${seconds}`;
      }

      requestAnimationFrame(updateDuration);
    };

    requestAnimationFrame(updateDuration);
  }

  private startVisualizerAnimation(): void {
    const canvas = document.getElementById("buzzi-call-visualizer-canvas") as HTMLCanvasElement;
    if (!canvas || !this.analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const color = this.config.primaryColor ?? "#6437F3";

    const draw = () => {
      if (this.state !== "active" && this.state !== "muted") return;

      this.animationFrameId = requestAnimationFrame(draw);
      this.analyser?.getByteFrequencyData(dataArray);

      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = ((dataArray[i] ?? 0) / 255) * canvas.height * 0.8;

        ctx.fillStyle = color;
        ctx.fillRect(
          x,
          canvas.height / 2 - barHeight / 2,
          barWidth - 1,
          barHeight
        );

        x += barWidth;
      }
    };

    draw();
  }

  // ============================================================================
  // Audio Utilities
  // ============================================================================

  private float32ToPCM16(float32Array: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i] ?? 0));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm16;
  }

  private pcm16ToFloat32(pcm16Array: Int16Array): Float32Array {
    const float32 = new Float32Array(pcm16Array.length);
    for (let i = 0; i < pcm16Array.length; i++) {
      const sample = pcm16Array[i] ?? 0;
      float32[i] = sample / (sample < 0 ? 0x8000 : 0x7fff);
    }
    return float32;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i] ?? 0);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// ============================================================================
// Auto-initialization
// ============================================================================

function initCallWidget(): void {
  if (typeof window !== "undefined" && window.CALL_WIDGET_CONFIG) {
    new BuzziCallWidget(window.CALL_WIDGET_CONFIG);
  }
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCallWidget);
} else {
  if ("requestIdleCallback" in window) {
    (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(
      initCallWidget
    );
  } else {
    setTimeout(initCallWidget, 0);
  }
}

// Add CSS animation
const style = document.createElement("style");
style.textContent = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
`;
document.head.appendChild(style);

export { BuzziCallWidget };
