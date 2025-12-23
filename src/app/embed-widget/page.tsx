"use client";

/**
 * Chat Widget Page
 *
 * This page renders inside the widget iframe and provides the full chat interface.
 * It communicates with the parent window via postMessage.
 */

import { useEffect, useState, useRef, useCallback, FormEvent } from "react";
import { cn } from "@/lib/utils";

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
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

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

    eventSource.addEventListener("thinking", () => {
      setIsTyping(true);
    });

    eventSource.addEventListener("delta", (event) => {
      const data = JSON.parse(event.data);
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
        {messages.map((message) => (
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
        ))}

        {isTyping && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div
              className={cn(
                "rounded-2xl rounded-bl-sm px-4 py-2.5",
                isDark ? "bg-zinc-800" : "bg-white shadow-sm"
              )}
            >
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
              </span>
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
        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl px-4 py-2",
            isDark ? "bg-zinc-800" : "bg-gray-100"
          )}
        >
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
