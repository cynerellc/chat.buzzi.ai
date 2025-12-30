"use client";

/**
 * Chat Widget Page
 *
 * This page renders inside the widget iframe and provides the full chat interface.
 * It communicates with the parent window via postMessage.
 */

import { useEffect, useState, useRef, useCallback, FormEvent } from "react";
import { cn } from "@/lib/utils";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";

// ============================================================================
// Types
// ============================================================================

interface WidgetConfig {
  agentId: string;
  companyId: string;
  theme: "light" | "dark" | "auto";
  primaryColor: string;
  title?: string;
  subtitle?: string;
  avatarUrl?: string;
  welcomeMessage?: string;
  placeholderText?: string;
  showBranding?: boolean;
  enableFileUpload?: boolean;
  enableEmoji?: boolean;
  enableVoice?: boolean;
  enableTypingIndicator?: boolean;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  };
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  status?: "sending" | "sent" | "error";
  isNotification?: boolean;
  targetAgentName?: string;
}

interface Session {
  sessionId: string;
  conversationId: string;
  endUserId: string;
}

// ============================================================================
// Component
// ============================================================================

export default function WidgetPage() {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingText, setThinkingText] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sendMessageRef = useRef<(content: string) => void>(() => {});

  // Voice recording for push-to-talk
  const handleVoiceTranscript = useCallback((text: string) => {
    if (text.trim()) {
      sendMessageRef.current(text);
    }
  }, []);

  const {
    isRecording,
    isSupported: isVoiceSupported,
    transcript: voiceTranscript,
    duration: recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecording({
    onTranscript: handleVoiceTranscript,
    maxDuration: 60,
  });

  // Get config from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const agentId = params.get("agentId");
    const companyId = params.get("companyId");
    const theme = (params.get("theme") as WidgetConfig["theme"]) || "light";
    const primaryColor = params.get("primaryColor") || "#007bff";
    const customerStr = params.get("customer");

    if (!agentId || !companyId) {
      setError("Missing required configuration");
      return;
    }

    const customer = customerStr ? JSON.parse(customerStr) : undefined;

    const initialConfig: WidgetConfig = {
      agentId,
      companyId,
      theme,
      primaryColor,
      customer,
    };

    // Fetch full config from API
    fetchConfig(agentId, companyId, initialConfig);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Setup parent window communication
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data ?? {};

      switch (type) {
        case "config":
          setConfig((prev) => ({ ...prev, ...data }));
          break;
        case "sendMessage":
          if (data?.content) {
            handleSendMessage(data.content);
          }
          break;
        case "clearHistory":
          setMessages([]);
          break;
        case "setCustomer":
          setConfig((prev) => prev ? { ...prev, customer: data } : null);
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    // Notify parent that widget is ready
    notifyParent("widget:ready", {});

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Create session when config is ready
  useEffect(() => {
    if (config && !session) {
      createSession();
    }
  }, [config, session]);

  // Connect SSE when session is ready
  useEffect(() => {
    if (session) {
      connectSSE();
    }

    return () => {
      eventSourceRef.current?.close();
    };
  }, [session]);

  // ============================================================================
  // API Functions
  // ============================================================================

  const fetchConfig = async (
    agentId: string,
    companyId: string,
    initialConfig: WidgetConfig
  ) => {
    try {
      const response = await fetch(
        `/api/widget/config?agentId=${agentId}&companyId=${companyId}`
      );

      if (response.ok) {
        const data = await response.json();
        setConfig({ ...initialConfig, ...data.config });

        // Add welcome message if configured
        if (data.config?.welcomeMessage) {
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content: data.config.welcomeMessage,
              timestamp: new Date(),
            },
          ]);
        }
      } else {
        setConfig(initialConfig);
      }
    } catch {
      setConfig(initialConfig);
    }
  };

  const createSession = async () => {
    if (!config) return;

    try {
      const response = await fetch("/api/widget/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: config.agentId,
          companyId: config.companyId,
          customer: config.customer,
          pageUrl: document.referrer,
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const data = await response.json();
      setSession(data);
      notifyParent("widget:session", data);
    } catch (err) {
      setError("Failed to connect. Please try again.");
      notifyParent("widget:error", { message: "Failed to create session" });
    }
  };

  const connectSSE = () => {
    if (!session) return;

    const eventSource = new EventSource(
      `/api/widget/${session.sessionId}/stream`
    );
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("connected", () => {
      setIsConnected(true);
    });

    eventSource.addEventListener("thinking", (event) => {
      setIsTyping(true);
      // Parse thinking text if available
      try {
        const data = JSON.parse(event.data);
        if (data.content) {
          setThinkingText(data.content);
        }
      } catch {
        // No thinking text, just show indicator
        setThinkingText(null);
      }
    });

    eventSource.addEventListener("notification", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          // Add notification message to chat
          setMessages((prev) => [
            ...prev,
            {
              id: `notification-${Date.now()}`,
              role: "system",
              content: data.message,
              timestamp: new Date(),
              isNotification: true,
              targetAgentName: data.targetAgentName,
            },
          ]);
        }
      } catch {
        // Ignore parsing errors
      }
    });

    eventSource.addEventListener("delta", (event) => {
      const data = JSON.parse(event.data);
      // Clear thinking text when we start receiving content
      setThinkingText(null);
      // Handle streaming delta updates
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === "assistant" && lastMessage.status === "sending") {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              content: lastMessage.content + data.content,
            },
          ];
        }
        return prev;
      });
    });

    eventSource.addEventListener("complete", (event) => {
      const data = JSON.parse(event.data);
      setIsTyping(false);
      setThinkingText(null);

      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === "assistant" && lastMessage.status === "sending") {
          return [
            ...prev.slice(0, -1),
            {
              id: data.messageId || lastMessage.id,
              role: "assistant",
              content: data.content,
              timestamp: new Date(),
              status: "sent",
            },
          ];
        }
        // New message
        return [
          ...prev,
          {
            id: data.messageId || `msg-${Date.now()}`,
            role: "assistant",
            content: data.content,
            timestamp: new Date(),
            status: "sent",
          },
        ];
      });

      notifyParent("widget:message", {
        role: "assistant",
        content: data.content,
      });
    });

    eventSource.addEventListener("error", () => {
      setIsTyping(false);
      setIsConnected(false);
    });

    eventSource.onerror = () => {
      eventSource.close();
      setIsConnected(false);
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (session) {
          connectSSE();
        }
      }, 5000);
    };
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !session) return;

      const messageId = `msg-${Date.now()}`;

      // Add user message
      const userMessage: Message = {
        id: messageId,
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
        status: "sending",
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");

      // Add placeholder for assistant response
      setMessages((prev) => [
        ...prev,
        {
          id: `response-${Date.now()}`,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          status: "sending",
        },
      ]);

      try {
        const response = await fetch(`/api/widget/${session.sessionId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.trim() }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        // Update user message status
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, status: "sent" } : msg
          )
        );
      } catch {
        // Mark as error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, status: "error" } : msg
          )
        );
        setError("Failed to send message");
      }
    },
    [session]
  );

  // Keep sendMessageRef in sync for voice recording callback
  useEffect(() => {
    sendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const handleClose = () => {
    notifyParent("widget:close", {});
  };

  const handleMinimize = () => {
    notifyParent("widget:minimize", {});
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const notifyParent = (type: string, data: unknown) => {
    if (window.parent !== window) {
      window.parent.postMessage({ type, data }, "*");
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (error && !config) {
    return (
      <div className="flex h-screen items-center justify-center p-4 text-center text-muted-foreground">
        <p>{error}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const isDark = config.theme === "dark";

  return (
    <div
      className={cn(
        "flex h-screen flex-col",
        isDark ? "bg-zinc-900 text-white" : "bg-white text-zinc-900"
      )}
      style={{ "--primary-color": config.primaryColor } as React.CSSProperties}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between p-4"
        style={{ backgroundColor: config.primaryColor }}
      >
        <div className="flex items-center gap-3">
          {config.avatarUrl && (
            <img
              src={config.avatarUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          )}
          <div>
            <h1 className="font-semibold text-white">
              {config.title || "Chat Support"}
            </h1>
            {config.subtitle && (
              <p className="text-sm text-white/80">{config.subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleMinimize}
            className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Minimize"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5" />
            </svg>
          </button>
          <button
            onClick={handleClose}
            className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div
        className={cn(
          "flex-1 overflow-y-auto p-4 space-y-4",
          isDark ? "bg-zinc-900" : "bg-gray-50"
        )}
      >
        {messages.map((message) => {
          // Render notification messages differently
          if (message.isNotification) {
            return (
              <div
                key={message.id}
                className="flex justify-center my-3"
              >
                <div
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm",
                    isDark ? "bg-zinc-800/80 text-zinc-300" : "bg-gray-100 text-gray-600"
                  )}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                  <span>{message.content}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5",
                  message.role === "user"
                    ? "rounded-br-sm text-white"
                    : cn(
                        "rounded-bl-sm",
                        isDark ? "bg-zinc-800" : "bg-white shadow-sm"
                      ),
                  message.status === "sending" && "opacity-70"
                )}
                style={
                  message.role === "user"
                    ? { backgroundColor: config.primaryColor }
                    : undefined
                }
              >
                {message.content || (
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div
              className={cn(
                "rounded-2xl rounded-bl-sm px-4 py-2.5",
                isDark ? "bg-zinc-800" : "bg-white shadow-sm"
              )}
            >
              {thinkingText ? (
                <div className="space-y-1.5">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium",
                      isDark ? "text-zinc-400" : "text-gray-500"
                    )}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="animate-pulse"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                    <span>Thinking...</span>
                  </div>
                  <p
                    className={cn(
                      "text-sm italic",
                      isDark ? "text-zinc-300" : "text-gray-600"
                    )}
                  >
                    {thinkingText}
                  </p>
                </div>
              ) : (
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className={cn(
          "border-t p-4",
          isDark ? "border-zinc-800 bg-zinc-900" : "border-gray-200 bg-white"
        )}
      >
        {/* Recording Overlay */}
        {isRecording && (
          <div
            className={cn(
              "mb-3 rounded-xl p-4",
              isDark ? "bg-zinc-800" : "bg-gray-100"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center animate-pulse"
                  style={{ backgroundColor: `${config.primaryColor}20` }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={config.primaryColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                </div>
                <span
                  className="absolute -top-1 -right-1 flex h-3 w-3"
                >
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: "#ef4444" }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-3 w-3"
                    style={{ backgroundColor: "#ef4444" }}
                  />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">Recording...</span>
                  <span className={cn("text-xs", isDark ? "text-zinc-400" : "text-gray-500")}>
                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                {voiceTranscript && (
                  <p className={cn("text-sm truncate", isDark ? "text-zinc-300" : "text-gray-600")}>
                    {voiceTranscript}
                  </p>
                )}
                {!voiceTranscript && (
                  <p className={cn("text-sm italic", isDark ? "text-zinc-500" : "text-gray-400")}>
                    Speak now...
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={cancelRecording}
                className={cn(
                  "rounded-full p-2 transition-colors",
                  isDark ? "hover:bg-zinc-700 text-zinc-400" : "hover:bg-gray-200 text-gray-500"
                )}
                aria-label="Cancel recording"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className={cn("text-xs mt-2 text-center", isDark ? "text-zinc-500" : "text-gray-400")}>
              Release to send • Click X to cancel
            </p>
          </div>
        )}

        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl px-4 py-2",
            isDark ? "bg-zinc-800" : "bg-gray-100",
            isRecording && "opacity-50 pointer-events-none"
          )}
        >
          {/* Push-to-talk microphone button */}
          {config.enableVoice && isVoiceSupported && (
            <button
              type="button"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={cn(
                "rounded-full p-2 transition-colors shrink-0",
                isRecording
                  ? "text-white"
                  : isDark
                  ? "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700"
                  : "text-gray-500 hover:text-gray-600 hover:bg-gray-200"
              )}
              style={isRecording ? { backgroundColor: config.primaryColor } : undefined}
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
          )}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={config.placeholderText || "Type a message..."}
            rows={1}
            className={cn(
              "max-h-32 flex-1 resize-none bg-transparent py-1 outline-none",
              isDark ? "placeholder:text-zinc-500" : "placeholder:text-gray-400"
            )}
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className={cn(
              "rounded-full p-2 transition-colors",
              inputValue.trim()
                ? "text-white"
                : isDark
                ? "text-zinc-600"
                : "text-gray-400"
            )}
            style={
              inputValue.trim()
                ? { backgroundColor: config.primaryColor }
                : undefined
            }
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </div>
      </form>

      {/* Branding */}
      {config.showBranding && (
        <div
          className={cn(
            "py-2 text-center text-xs",
            isDark ? "text-zinc-500" : "text-gray-400"
          )}
        >
          Powered by{" "}
          <a
            href="https://buzzi.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: config.primaryColor }}
          >
            Buzzi
          </a>
        </div>
      )}
    </div>
  );
}
