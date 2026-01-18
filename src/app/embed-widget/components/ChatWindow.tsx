"use client";

/**
 * ChatWindow Component
 *
 * Reusable chat widget component that can be used in:
 * 1. Embed widget page (fetches config from API)
 * 2. Admin preview (uses passed configJson directly)
 *
 * Props:
 * - isDemo: When true, uses configJson instead of fetching from API
 * - configJson: Widget configuration for demo/preview mode
 */

import { useEffect, useState, useRef, useCallback, FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { TransferBubble } from "./TransferBubble";
import { ThinkingBubble, type ToolCallState } from "./ThinkingBubble";
import { VoiceMessageBubble } from "./VoiceMessageBubble";
import { HumanWaitingBubble } from "./HumanWaitingBubble";
import { HumanJoinedBubble, HumanExitedBubble } from "./HumanJoinedBubble";
import { AuthFormBubble } from "./AuthFormBubble";
import { CallDialog } from "./CallDialog";
import { CallHistory } from "./CallHistory";
import { useCallSession } from "../hooks/useCallSession";
import type {
  AgentInfo,
  AuthField,
  AuthState,
  ChatWindowConfig,
  ChatWindowProps,
  Message,
  Session,
  ThinkingState,
} from "./types";
import { getContrastTextColor } from "./types";
import {
  isRealtimeConfigured,
  getSupabaseBrowserClient,
} from "@/lib/supabase/realtime";

// Re-export types for backwards compatibility
export type { AgentInfo, ChatWindowConfig, ChatWindowProps } from "./types";

// ============================================================================
// Legacy Types (kept for compatibility, use types.ts for new code)
// ============================================================================

// Types moved to ./types.ts - this section is for reference only
// See: AgentInfo, ChatWindowConfig, ChatWindowProps, Message, Session, ThinkingState


// ============================================================================
// Component
// ============================================================================

export function ChatWindow({
  isDemo = false,
  configJson,
  agentId: propAgentId,
  companyId: propCompanyId,
  className,
  style,
}: ChatWindowProps) {
  const [config, setConfig] = useState<ChatWindowConfig | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isTyping, _setIsTyping] = useState(false);
  const [thinkingState, setThinkingState] = useState<ThinkingState | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isConnected, _setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [visibleAgents, setVisibleAgents] = useState<Set<string>>(new Set());
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  // Pre-chat form state
  const [showPreChatForm, setShowPreChatForm] = useState(false);
  const [preChatName, setPreChatName] = useState("");
  const [preChatEmail, setPreChatEmail] = useState("");
  const [preChatSubmitted, setPreChatSubmitted] = useState(false);
  const [isInitializingSession, setIsInitializingSession] = useState(false);
  // Human escalation state
  const [isWaitingForHuman, setIsWaitingForHuman] = useState(false);
  const [isWithHuman, setIsWithHuman] = useState(false);
  const [currentHumanAgent, setCurrentHumanAgent] = useState<{
    id: string;
    name: string;
    avatarUrl?: string;
  } | null>(null);

  // Authentication state
  const [authState, setAuthState] = useState<AuthState>({
    isRequired: false,
    isAuthenticated: false,
  });
  // Pending message that triggered auth - will be auto-resent after login
  const [pendingAuthMessage, setPendingAuthMessage] = useState<string | null>(null);

  // Call dialog state
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  // Call-only mode: when mode=call URL param is set, show only call widget
  const [isCallOnlyMode, setIsCallOnlyMode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sendMessageRef = useRef<(content: string) => void>(() => {});
  const agentsListRef = useRef<HTMLDivElement>(null);
  const messageAudioRef = useRef<HTMLAudioElement | null>(null);
  const visibleAgentsRef = useRef<Set<string>>(visibleAgents);
  const animatedAgentsRef = useRef<Set<string>>(new Set());

  // State for voice message sending
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  // State for PTT help message (shown when user clicks instead of holds)
  const [showPttHelp, setShowPttHelp] = useState(false);
  const pttHelpTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Voice recording for push-to-talk
  const {
    isRecording,
    isStarting: isVoiceStarting,
    isSupported: isVoiceSupported,
    duration: recordingDuration,
    audioData,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecording({
    maxDuration: 60,
    onError: (err) => {
      console.error("Voice recording error:", err);
      setError(err);
    },
  });

  // Voice call session management
  const callSession = useCallSession({
    chatbotId: config?.agentId || "",
    companyId: config?.companyId || "",
    callConfig: config?.callConfig,
    callerName: preChatName || undefined,
    callerEmail: preChatEmail || undefined,
    onError: (err) => {
      console.error("Call error:", err);
      setError(err);
    },
  });

  // Initialize config - either from props (demo) or URL params (production)
  useEffect(() => {
    if (isDemo && configJson) {
      // Demo mode: use passed config directly
      const demoConfig: ChatWindowConfig = {
        agentId: configJson.agentId || "demo",
        companyId: configJson.companyId || "demo",
        theme: configJson.theme || "light",
        primaryColor: configJson.primaryColor || "#6437F3",
        accentColor: configJson.accentColor,
        userBubbleColor: configJson.userBubbleColor,
        overrideAgentColor: configJson.overrideAgentColor ?? false,
        agentBubbleColor: configJson.agentBubbleColor,
        borderRadius: configJson.borderRadius ?? 16,
        position: configJson.position ?? "bottom-right",
        title: configJson.title,
        subtitle: configJson.subtitle,
        avatarUrl: configJson.avatarUrl,
        logoUrl: configJson.logoUrl,
        welcomeMessage: configJson.welcomeMessage,
        placeholderText: configJson.placeholderText,
        showBranding: configJson.showBranding ?? true,
        enableFileUpload: configJson.enableFileUpload ?? false,
        enableEmoji: configJson.enableEmoji ?? true,
        enableVoice: configJson.enableVoice ?? false,
        enableTypingIndicator: true,
        enableMarkdown: configJson.enableMarkdown ?? true,
        launcherIcon: configJson.launcherIcon,
        isMultiAgent: configJson.isMultiAgent ?? false,
        agentsList: configJson.agentsList,
        showAgentSwitchNotification: configJson.showAgentSwitchNotification ?? true,
        showThinking: configJson.showThinking ?? false,
        showInstantUpdates: configJson.showInstantUpdates ?? true,
        showAgentListOnTop: configJson.showAgentListOnTop ?? true,
        agentListMinCards: configJson.agentListMinCards ?? 3,
        agentListingType: configJson.agentListingType ?? "detailed",
        customCss: configJson.customCss,
        autoOpen: configJson.autoOpen ?? false,
        autoOpenDelay: configJson.autoOpenDelay ?? 5,
        playSoundOnMessage: configJson.playSoundOnMessage ?? true,
        persistConversation: configJson.persistConversation ?? true,
        requireEmail: configJson.requireEmail ?? false,
        requireName: configJson.requireName ?? false,
      };

      setConfig(demoConfig);
      setPreChatSubmitted(true); // Skip pre-chat in demo mode

      // Set first agent as active and visible for multi-agent
      if (demoConfig.isMultiAgent && demoConfig.agentsList?.length) {
        const firstAgentId = demoConfig.agentsList[0]?.id;
        if (firstAgentId) {
          setActiveAgentId(firstAgentId);
          setVisibleAgents(new Set([firstAgentId]));
        }
      }

      // Add welcome message if configured
      if (demoConfig.welcomeMessage) {
        const firstAgent = demoConfig.agentsList?.[0];
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: demoConfig.welcomeMessage,
            timestamp: new Date(),
            agentId: firstAgent?.id,
            agentName: firstAgent?.name,
            agentAvatarUrl: firstAgent?.avatarUrl,
            agentColor: firstAgent?.color,
          },
        ]);
      }
      return;
    }

    // Production mode: get config from URL params or props
    const params = new URLSearchParams(window.location.search);
    // Support both agentId (legacy) and chatbotId parameters
    const agentId = propAgentId || params.get("chatbotId") || params.get("agentId");
    const companyId = propCompanyId || params.get("companyId");
    const isPreviewMode = params.get("preview") === "true";
    const theme = (params.get("theme") as ChatWindowConfig["theme"]) || "light";
    const primaryColor = params.get("primaryColor") || "#007bff";
    const customerStr = params.get("customer");
    // Check for call-only mode
    const mode = params.get("mode");
    if (mode === "call") {
      setIsCallOnlyMode(true);
      setIsCallDialogOpen(true); // Auto-open call dialog in call-only mode
    }

    if (!agentId || !companyId) {
      setError("Missing required configuration");
      return;
    }

    const customer = customerStr ? JSON.parse(customerStr) : undefined;

    const initialConfig: ChatWindowConfig = {
      agentId,
      companyId,
      theme,
      primaryColor,
      customer,
      isPreview: isPreviewMode,
    };

    // Fetch full config from API
    fetchConfig(agentId, companyId, initialConfig, isPreviewMode);
  }, [isDemo, configJson, propAgentId, propCompanyId]);

  // Scroll to bottom on new messages (only within the messages container, not the whole page)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // Scroll to active agent in horizontal list
  useEffect(() => {
    if (activeAgentId && agentsListRef.current && config?.isMultiAgent) {
      const activeElement = agentsListRef.current.querySelector(
        `[data-agent-id="${activeAgentId}"]`
      );
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [activeAgentId, config?.isMultiAgent]);

  // Inject custom CSS if provided
  useEffect(() => {
    if (!config?.customCss) return;

    const style = document.createElement("style");
    style.setAttribute("data-widget-custom-css", "true");
    style.textContent = config.customCss;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, [config?.customCss]);

  // Check if pre-chat form is needed (skip in demo mode)
  useEffect(() => {
    if (!config || isDemo) return;

    const requiresPreChat = config.requireEmail || config.requireName;
    if (!requiresPreChat) {
      setPreChatSubmitted(true);
      return;
    }

    // Check localStorage for existing customer data
    const storageKey = `buzzi_widget_${config.agentId}_customer`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const customer = JSON.parse(stored);
        if ((!config.requireEmail || customer.email) && (!config.requireName || customer.name)) {
          setPreChatName(customer.name || "");
          setPreChatEmail(customer.email || "");
          setPreChatSubmitted(true);
          setConfig((prev) => prev ? { ...prev, customer: { ...prev.customer, ...customer } } : null);
          return;
        }
      }
    } catch {
      // localStorage not available or parse error
    }

    setShowPreChatForm(true);
  }, [config?.agentId, config?.requireEmail, config?.requireName, isDemo]);

  // Load persisted conversation from localStorage (skip in demo mode)
  useEffect(() => {
    if (!config || !session || !config.persistConversation || isDemo) return;

    const storageKey = `buzzi_widget_${config.agentId}_conversation`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const { messages: storedMessages, sessionId } = JSON.parse(stored);
        // Only restore if same session
        if (sessionId === session.sessionId && storedMessages?.length > 0) {
          setMessages(storedMessages.map((m: Message) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })));
        }
      }
    } catch {
      // localStorage not available or parse error
    }
  }, [config?.agentId, config?.persistConversation, session?.sessionId, isDemo]);

  // Persist conversation to localStorage (skip in demo mode)
  useEffect(() => {
    if (!config || !session || !config.persistConversation || messages.length === 0 || isDemo) return;

    const storageKey = `buzzi_widget_${config.agentId}_conversation`;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        sessionId: session.sessionId,
        messages: messages.filter(m => m.status === "sent" || m.role === "assistant"),
      }));
    } catch {
      // localStorage not available
    }
  }, [config?.agentId, config?.persistConversation, session?.sessionId, messages, isDemo]);

  // Play sound on new assistant message
  useEffect(() => {
    if (!config?.playSoundOnMessage || isDemo) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && lastMessage.status === "sent") {
      // Create audio element if not exists
      if (!messageAudioRef.current) {
        messageAudioRef.current = new Audio("/sounds/message.mp3");
        messageAudioRef.current.volume = 0.5;
      }
      messageAudioRef.current.currentTime = 0;
      messageAudioRef.current.play().catch(() => {
        // Audio playback blocked by browser
      });
    }
  }, [config?.playSoundOnMessage, messages, isDemo]);

  // Setup parent window communication (skip in demo mode)
  useEffect(() => {
    if (isDemo) return;

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
          setConfig((prev) => (prev ? { ...prev, customer: data } : null));
          break;
        case "openCallDialog":
          setIsCallDialogOpen(true);
          break;
        case "closeCallDialog":
          setIsCallDialogOpen(false);
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    // Notify parent that widget is ready
    notifyParent("widget:ready", {});

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [isDemo]);

  // Notify parent when call dialog opens/closes
  useEffect(() => {
    if (typeof window !== "undefined" && window.parent !== window) {
      if (isCallDialogOpen) {
        window.parent.postMessage({ type: "widget:callDialogOpened" }, "*");
      } else {
        window.parent.postMessage({ type: "widget:callDialogClosed" }, "*");
      }
    }
  }, [isCallDialogOpen]);

  // Auto-close call dialog when call ends
  useEffect(() => {
    if (callSession.status === "ended") {
      setIsCallDialogOpen(false);
    }
  }, [callSession.status]);

  // Create session when config is ready (skip in demo mode)
  // Try to resume existing session first if persistence is enabled
  useEffect(() => {
    if (config && !session && !isDemo && !isInitializingSession) {
      setIsInitializingSession(true);
      if (config.persistConversation) {
        resumeSession().then((resumed) => {
          if (!resumed) {
            createSession();
          }
          setIsInitializingSession(false);
        });
      } else {
        createSession();
        setIsInitializingSession(false);
      }
    }
  }, [config, session, isDemo, isInitializingSession]);

  // Connect SSE when session is ready (skip in demo mode)
  useEffect(() => {
    if (session && !isDemo) {
      connectSSE();
    }

    return () => {
      eventSourceRef.current?.close();
    };
  }, [session, isDemo]);

  // Subscribe to conversation status changes via Supabase Realtime
  // This handles cross-process events (human_joined, human_exited) that SSE can't deliver
  useEffect(() => {
    if (!session?.conversationId || isDemo) return;
    if (!isRealtimeConfigured()) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`conversation-status:${session.conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "chatapp",
          table: "conversations",
          filter: `id=eq.${session.conversationId}`,
        },
        (payload) => {
          const newRecord = payload.new as { status?: string; assigned_user_id?: string } | null;
          const newStatus = newRecord?.status;
          const assignedUserId = newRecord?.assigned_user_id;

          if (newStatus === "with_human" && !isWithHuman) {
            // Human agent took over
            setIsWaitingForHuman(false);
            setIsWithHuman(true);
            // Fetch agent details
            if (assignedUserId) {
              fetchAssignedAgentDetails(assignedUserId);
            }
          } else if (newStatus === "active" && isWithHuman) {
            // Returned to AI
            setIsWithHuman(false);
            setCurrentHumanAgent(null);
            // Add exited bubble
            setMessages((prev) => [
              ...prev,
              {
                id: `human-exited-${Date.now()}`,
                role: "system" as const,
                content: "",
                timestamp: new Date(),
                isHumanExited: true,
                humanAgentName: currentHumanAgent?.name || "Support Agent",
              },
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.conversationId, isDemo, isWithHuman, currentHumanAgent?.name]);

  // Subscribe to new messages via Supabase Realtime
  // This handles human agent messages that come from a different process
  useEffect(() => {
    if (!session?.conversationId || isDemo) return;
    if (!isRealtimeConfigured()) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`messages:${session.conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "chatapp",
          table: "messages",
          filter: `conversation_id=eq.${session.conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as {
            id?: string;
            role?: string;
            content?: string;
            created_at?: string;
          } | null;
          // Only handle human_agent messages (AI messages come via SSE stream)
          if (newMsg?.role === "human_agent" && newMsg.id) {
            const msgId = newMsg.id; // Capture to ensure type is string
            const msgContent = newMsg.content || "";
            const msgTimestamp = newMsg.created_at ? new Date(newMsg.created_at) : new Date();
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === msgId)) return prev;
              return [
                ...prev,
                {
                  id: msgId,
                  role: "assistant" as const,
                  content: msgContent,
                  timestamp: msgTimestamp,
                  isFromHumanAgent: true,
                  // Add human agent info for proper display with avatar/name
                  humanAgentName: currentHumanAgent?.name || "Support Agent",
                  humanAgentAvatarUrl: currentHumanAgent?.avatarUrl,
                  agentName: currentHumanAgent?.name || "Support Agent",
                  agentAvatarUrl: currentHumanAgent?.avatarUrl,
                },
              ];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.conversationId, isDemo, currentHumanAgent]);

  // Fetch assigned agent details for displaying in HumanJoinedBubble
  const fetchAssignedAgentDetails = async (userId: string) => {
    if (!session) return;

    try {
      const res = await fetch(
        `/api/widget/${session.sessionId}/agent-info?userId=${userId}`
      );
      if (res.ok) {
        const { name, avatarUrl } = await res.json();
        setCurrentHumanAgent({
          id: userId,
          name: name || "Support Agent",
          avatarUrl,
        });
        // Add joined bubble
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.isHumanWaiting);
          return [
            ...filtered,
            {
              id: `human-joined-${Date.now()}`,
              role: "system" as const,
              content: "",
              timestamp: new Date(),
              isHumanJoined: true,
              humanAgentName: name || "Support Agent",
              humanAgentAvatarUrl: avatarUrl,
            },
          ];
        });
      }
    } catch (err) {
      console.warn("Failed to fetch agent details:", err);
      setCurrentHumanAgent({ id: userId, name: "Support Agent" });
    }
  };

  // ============================================================================
  // API Functions
  // ============================================================================

  const fetchConfig = async (
    agentId: string,
    companyId: string,
    initialConfig: ChatWindowConfig,
    isPreview = false
  ) => {
    try {
      let configData: ChatWindowConfig | null = null;

      // In preview mode, try the admin preview-config API first
      if (isPreview) {
        try {
          const response = await fetch(
            `/api/master-admin/companies/${companyId}/chatbots/${agentId}/preview-config`
          );

          if (response.ok) {
            const data = await response.json();
            configData = { ...initialConfig, ...data.config };
          }
        } catch {
          // Preview config failed, will fall back to widget/config API
        }
      }

      if (!configData) {
        // Production mode: try pre-generated JSON first
        try {
          const configUrlResponse = await fetch(
            `/api/widget/config-url?chatbotId=${agentId}&companyId=${companyId}`
          );

          if (configUrlResponse.ok) {
            const { configUrl } = await configUrlResponse.json();

            if (configUrl) {
              // Fetch the pre-generated JSON config from storage
              const jsonResponse = await fetch(configUrl);

              if (jsonResponse.ok) {
                const jsonConfig = await jsonResponse.json();

                // Transform WidgetConfigJson to internal ChatWindowConfig format
                configData = {
                  agentId,
                  companyId,
                  // Appearance
                  theme: jsonConfig.appearance?.theme || "light",
                  primaryColor: jsonConfig.appearance?.primaryColor || "#007bff",
                  accentColor: jsonConfig.appearance?.accentColor,
                  borderRadius: jsonConfig.appearance?.borderRadius ?? 16,
                  position: jsonConfig.appearance?.position ?? "bottom-right",
                  // Branding
                  title: jsonConfig.branding?.title,
                  subtitle: jsonConfig.branding?.subtitle,
                  avatarUrl: jsonConfig.branding?.avatarUrl,
                  logoUrl: jsonConfig.branding?.logoUrl,
                  welcomeMessage: jsonConfig.branding?.welcomeMessage,
                  showBranding: jsonConfig.branding?.showBranding ?? true,
                  // Features
                  enableFileUpload: jsonConfig.features?.enableFileUpload ?? false,
                  enableEmoji: jsonConfig.features?.enableEmoji ?? true,
                  enableVoice: jsonConfig.features?.enableVoiceMessages ?? false,
                  enableTypingIndicator: true,
                  launcherIcon: jsonConfig.appearance?.launcherIcon,
                  isMultiAgent: jsonConfig.chatbot?.type === "multi_agent",
                  agentsList: jsonConfig.agents?.map((agent: { id: string; name: string; designation?: string; avatarUrl?: string; type?: string }) => ({
                    id: agent.id,
                    name: agent.name,
                    designation: agent.designation,
                    avatarUrl: agent.avatarUrl,
                    type: agent.type,
                  })),
                  // Stream Display Options
                  showAgentSwitchNotification: jsonConfig.streamDisplay?.showAgentSwitchNotification ?? true,
                  showThinking: jsonConfig.streamDisplay?.showThinking ?? false,
                  showInstantUpdates: jsonConfig.streamDisplay?.showInstantUpdates ?? true,
                  // Multi-agent Display Options
                  showAgentListOnTop: jsonConfig.multiAgent?.showAgentListOnTop ?? true,
                  agentListMinCards: jsonConfig.multiAgent?.agentListMinCards ?? 3,
                  agentListingType: jsonConfig.multiAgent?.agentListingType ?? "detailed",
                  // Custom CSS
                  customCss: jsonConfig.customCss,
                  // Behavior
                  autoOpen: jsonConfig.behavior?.autoOpen ?? false,
                  autoOpenDelay: jsonConfig.behavior?.autoOpenDelay ?? 5,
                  playSoundOnMessage: jsonConfig.behavior?.playSoundOnMessage ?? true,
                  persistConversation: jsonConfig.behavior?.persistConversation ?? true,
                  // Pre-chat requirements
                  requireEmail: jsonConfig.features?.requireEmail ?? false,
                  requireName: jsonConfig.features?.requireName ?? false,
                };
              }
            }
          }
        } catch {
          // JSON config fetch failed, will fallback to API
        }

        // Fallback to original API if JSON config failed
        if (!configData) {
          const response = await fetch(
            `/api/widget/config?agentId=${agentId}&companyId=${companyId}`
          );

          if (response.ok) {
            const data = await response.json();
            const apiConfig = data.config;
            // Map call config from API format to ChatWindow format
            // API returns: call: { enabled, widgetConfig, ... }
            // ChatWindow expects: enableCall, callConfig
            configData = {
              ...initialConfig,
              ...apiConfig,
              // Map call feature config
              enableCall: apiConfig?.call?.enabled ?? false,
              callConfig: apiConfig?.call?.widgetConfig,
            };
          }
        }
      }

      if (configData) {
        const mergedConfig = { ...initialConfig, ...configData };
        setConfig(mergedConfig);

        // Set first agent as active and visible for multi-agent
        if (mergedConfig.isMultiAgent && mergedConfig.agentsList?.length) {
          const firstAgentId = mergedConfig.agentsList[0]?.id;
          if (firstAgentId) {
            setActiveAgentId(firstAgentId);
            setVisibleAgents(new Set([firstAgentId]));
          }
        }

        // Add welcome message if configured
        if (mergedConfig.welcomeMessage) {
          const firstAgent = mergedConfig.agentsList?.[0];
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content: mergedConfig.welcomeMessage,
              timestamp: new Date(),
              agentId: firstAgent?.id,
              agentName: firstAgent?.name,
              agentAvatarUrl: firstAgent?.avatarUrl,
              agentColor: firstAgent?.color,
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
      // Use preview session API for preview mode, regular API for production
      const endpoint = config.isPreview
        ? `/api/master-admin/companies/${config.companyId}/chatbots/${config.agentId}/preview-session`
        : "/api/widget/session";

      const response = await fetch(endpoint, {
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

      // Save session to localStorage if persistence is enabled
      if (config.persistConversation) {
        const storageKey = `buzzi_widget_${config.agentId}_session`;
        try {
          localStorage.setItem(storageKey, JSON.stringify({
            sessionId: data.sessionId,
            conversationId: data.conversationId,
            endUserId: data.endUserId,
            createdAt: new Date().toISOString(),
          }));
        } catch {
          // localStorage not available
        }
      }
    } catch {
      setError("Failed to connect. Please try again.");
      notifyParent("widget:error", { message: "Failed to create session" });
    }
  };

  const resumeSession = async (): Promise<boolean> => {
    if (!config || !config.persistConversation) return false;

    const storageKey = `buzzi_widget_${config.agentId}_session`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return false;

      const { sessionId, conversationId, endUserId } = JSON.parse(stored);
      if (!sessionId) return false;

      // Try to resume via API
      const response = await fetch("/api/widget/session/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          agentId: config.agentId,
          companyId: config.companyId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setSession({ sessionId, conversationId, endUserId });

          // Load messages from database
          if (data.messages && data.messages.length > 0) {
            const loadedMessages: Message[] = data.messages.map((m: { id: string; role: string; content: string; timestamp: string; agentId?: string }) => {
              const agent = m.agentId ? config.agentsList?.find(a => a.id === m.agentId) : config.agentsList?.[0];
              return {
                id: m.id,
                role: m.role as "user" | "assistant" | "system",
                content: m.content,
                timestamp: new Date(m.timestamp),
                status: "sent" as const,
                agentId: m.agentId || agent?.id,
                agentName: agent?.name,
                agentAvatarUrl: agent?.avatarUrl,
                agentColor: agent?.color,
              };
            });
            setMessages(loadedMessages);

            // Set the last active agent if multi-agent
            if (config.isMultiAgent && loadedMessages.length > 0) {
              const lastAssistantMsg = [...loadedMessages].reverse().find(m => m.role === "assistant");
              if (lastAssistantMsg?.agentId) {
                setActiveAgentId(lastAssistantMsg.agentId);
                // Collect all unique agent IDs that appeared in the conversation
                const visibleIds = new Set<string>();
                loadedMessages.forEach(m => {
                  if (m.agentId) visibleIds.add(m.agentId);
                });
                setVisibleAgents(visibleIds);
              }
            }
          }

          notifyParent("widget:session", { sessionId, conversationId, endUserId });
          return true;
        }
      }

      // Invalid session - clear localStorage
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`buzzi_widget_${config.agentId}_conversation`);
      return false;
    } catch {
      // localStorage not available or parse error
      return false;
    }
  };

  const connectSSE = () => {
    if (!session) return;

    const eventSource = new EventSource(
      `/api/widget/${session.sessionId}/stream`
    );
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("connected", () => {
      _setIsConnected(true);
    });

    eventSource.addEventListener("thinking", (event) => {
      _setIsTyping(true);
      // Always set thinkingState to show ThinkingBubble
      // Only include detailed text if showThinking is enabled
      try {
        const data = JSON.parse(event.data);
        setThinkingState((prev) => ({
          ...prev,
          text: config?.showThinking !== false ? (data.content || prev?.text) : undefined,
        }));
      } catch {
        // Set basic thinking state even on parse error
        setThinkingState((prev) => prev || {});
      }
    });

    eventSource.addEventListener("tool_call", (event) => {
      // Always update thinkingState for tool calls (to show ThinkingBubble)
      // Only include tool details if showThinking is enabled (tool calls shown inside thinking)
      try {
        const data = JSON.parse(event.data);
        // Map SSE status values to ThinkingBubble expected values
        const toolStatus = data.status === "executing" ? "running"
          : data.status === "completed" ? "completed"
          : data.status || "running";

        setThinkingState((prev) => ({
          ...prev,
          // Update thinking text with notification message from tool
          text: data.notification || prev?.text,
          // Only include toolCalls array if showThinking is enabled
          toolCalls: config?.showThinking
            ? [
                ...(prev?.toolCalls || []).filter((t) => t.name !== data.toolName),
                {
                  name: data.toolName,
                  status: toolStatus,
                  args: data.arguments,
                  notification: data.notification,
                },
              ]
            : prev?.toolCalls,
        }));
      } catch {
        // Ignore
      }
    });

    eventSource.addEventListener("agent", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.agentId) {
          setActiveAgentId(data.agentId);
        }
      } catch {
        // Ignore
      }
    });

    eventSource.addEventListener("notification", (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle human agent messages (new_message from human_agent)
        if (data.type === "new_message" && data.role === "human_agent") {
          const messageId = data.messageId || `human-msg-${Date.now()}`;
          const newMessage: Message = {
            id: messageId,
            role: "assistant", // Display as assistant-style bubble
            content: data.content,
            timestamp: new Date(data.createdAt || Date.now()),
            status: "sent",
            isFromHumanAgent: true,
            humanAgentName: data.userName,
            humanAgentId: data.userId,
            // Add agentName/agentAvatarUrl for rendering compatibility
            agentName: data.userName || "Support Agent",
            agentAvatarUrl: data.avatarUrl || currentHumanAgent?.avatarUrl,
          };

          // Avoid duplicates
          setMessages((prev) => {
            if (prev.some((m) => m.id === messageId)) return prev;
            return [...prev, newMessage];
          });

          // Play notification sound if enabled
          if (config?.playSoundOnMessage && messageAudioRef.current) {
            messageAudioRef.current.play().catch(() => {});
          }
          return;
        }

        // Handle agent-to-agent transfer notifications
        if (data.message && data.targetAgentId) {
          // Check if the target agent is already visible (use ref for current value in callback)
          const isAgentAlreadyVisible = visibleAgentsRef.current.has(data.targetAgentId);

          // Add new agent to visible agents (will persist even after this transfer)
          if (!isAgentAlreadyVisible) {
            setVisibleAgents((prev) => new Set([...prev, data.targetAgentId]));
          }

          // Only show transfer bubble if agent was NOT already visible
          // and showAgentSwitchNotification is enabled
          if (!isAgentAlreadyVisible && config?.showAgentSwitchNotification !== false) {
            // Get previous agent - fallback to supervisor if none
            const previousAgentId = data.previousAgentId;
            const previousAgent = previousAgentId
              ? config?.agentsList?.find((a) => a.id === previousAgentId)
              : config?.agentsList?.find((a) => a.type === "supervisor") ||
                config?.agentsList?.[0];

            // Get new agent info
            const newAgent = config?.agentsList?.find(
              (a) => a.id === data.targetAgentId
            );

            setMessages((prev) => [
              ...prev,
              {
                id: `transfer-${Date.now()}`,
                role: "system",
                content: data.message,
                timestamp: new Date(),
                isNotification: true,
                isTransfer: true,
                targetAgentId: data.targetAgentId,
                targetAgentName: newAgent?.name || data.targetAgentName,
                targetAgentAvatarUrl:
                  newAgent?.avatarUrl || data.targetAgentAvatarUrl,
                targetAgentDesignation:
                  newAgent?.designation || data.targetAgentDesignation,
                previousAgentId: previousAgent?.id || data.previousAgentId,
                previousAgentName: previousAgent?.name || data.previousAgentName,
                previousAgentAvatarUrl:
                  previousAgent?.avatarUrl || data.previousAgentAvatarUrl,
              },
            ]);
          }

          // Update active agent if transfer (always do this regardless of notification setting)
          setActiveAgentId(data.targetAgentId);
        }
      } catch {
        // Ignore parsing errors
      }
    });

    eventSource.addEventListener("delta", (event) => {
      const data = JSON.parse(event.data);
      // Clear thinking state when we start receiving content
      setThinkingState(null);

      // If showInstantUpdates is disabled, just keep typing indicator and wait for complete message
      if (config?.showInstantUpdates === false) {
        return;
      }

      // Handle streaming delta updates
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (
          lastMessage?.role === "assistant" &&
          lastMessage.status === "sending"
        ) {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              content: lastMessage.content + data.content,
            },
          ];
        }
        // Create new streaming message if none exists
        const newMsgId = `stream-${Date.now()}`;
        setStreamingMessageId(newMsgId);
        const activeAgent = config?.agentsList?.find(
          (a) => a.id === activeAgentId
        );
        return [
          ...prev,
          {
            id: newMsgId,
            role: "assistant",
            content: data.content,
            timestamp: new Date(),
            status: "sending",
            agentId: activeAgentId || undefined,
            agentName: activeAgent?.name,
            agentAvatarUrl: activeAgent?.avatarUrl,
            agentColor: activeAgent?.color,
          },
        ];
      });
    });

    eventSource.addEventListener("complete", (event) => {
      const data = JSON.parse(event.data);
      _setIsTyping(false);
      setThinkingState(null);
      setStreamingMessageId(null);

      const activeAgent = config?.agentsList?.find(
        (a) => a.id === (data.agentId || activeAgentId)
      );

      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (
          lastMessage?.role === "assistant" &&
          lastMessage.status === "sending"
        ) {
          return [
            ...prev.slice(0, -1),
            {
              id: data.messageId || lastMessage.id,
              role: "assistant",
              content: data.content,
              timestamp: new Date(),
              status: "sent" as const,
              agentId: data.agentId || activeAgentId || undefined,
              agentName: data.agentName || activeAgent?.name,
              agentAvatarUrl: data.agentAvatarUrl || activeAgent?.avatarUrl,
              agentColor: activeAgent?.color,
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
            status: "sent" as const,
            agentId: data.agentId || activeAgentId || undefined,
            agentName: data.agentName || activeAgent?.name,
            agentAvatarUrl: data.agentAvatarUrl || activeAgent?.avatarUrl,
            agentColor: activeAgent?.color,
          },
        ];
      });

      // Update active agent if provided
      if (data.agentId) {
        setActiveAgentId(data.agentId);
      }

      notifyParent("widget:message", {
        role: "assistant",
        content: data.content,
      });
    });

    eventSource.addEventListener("error", () => {
      _setIsTyping(false);
      _setIsConnected(false);
    });

    // Human escalation events (from escalation service via SSE)
    eventSource.addEventListener("human_escalation", (event) => {
      try {
        const data = JSON.parse(event.data);
        setIsWaitingForHuman(true);
        setThinkingState(null);
        _setIsTyping(false);

        setMessages((prev) => [
          ...prev,
          {
            id: `human-waiting-${Date.now()}`,
            role: "system",
            content: data.reason || "Connecting you with a human agent",
            timestamp: new Date(),
            isHumanWaiting: true,
            previousAgentId: data.initiatingAgentId,
            previousAgentName: data.initiatingAgentName,
            escalationReason: data.reason,
          },
        ]);
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.addEventListener("human_joined", (event) => {
      try {
        const data = JSON.parse(event.data);
        setIsWaitingForHuman(false);
        setIsWithHuman(true);
        setCurrentHumanAgent({
          id: data.humanAgentId,
          name: data.humanAgentName,
          avatarUrl: data.humanAgentAvatarUrl,
        });

        // Remove waiting bubble and add joined bubble
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.isHumanWaiting);
          return [
            ...filtered,
            {
              id: `human-joined-${Date.now()}`,
              role: "system",
              content: `${data.humanAgentName} joined the conversation`,
              timestamp: new Date(),
              isHumanJoined: true,
              humanAgentId: data.humanAgentId,
              humanAgentName: data.humanAgentName,
              humanAgentAvatarUrl: data.humanAgentAvatarUrl,
            },
          ];
        });
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.addEventListener("human_exited", (event) => {
      try {
        const data = JSON.parse(event.data);
        setIsWithHuman(false);
        const exitedAgent = currentHumanAgent;
        setCurrentHumanAgent(null);

        setMessages((prev) => [
          ...prev,
          {
            id: `human-exited-${Date.now()}`,
            role: "system",
            content: `${exitedAgent?.name || data.humanAgentName || "Support agent"} left the conversation`,
            timestamp: new Date(),
            isHumanExited: true,
            humanAgentId: exitedAgent?.id || data.humanAgentId,
            humanAgentName: exitedAgent?.name || data.humanAgentName,
            humanAgentAvatarUrl: exitedAgent?.avatarUrl || data.humanAgentAvatarUrl,
          },
        ]);
      } catch {
        // Ignore parse errors
      }
    });

    // Listen for escalation cancelled event (user cancelled waiting for human)
    eventSource.addEventListener("escalation_cancelled", () => {
      setIsWaitingForHuman(false);
      // Remove waiting bubble from messages
      setMessages((prev) => prev.filter((m) => !m.isHumanWaiting));
    });

    eventSource.onerror = () => {
      eventSource.close();
      _setIsConnected(false);
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
      if (!content.trim()) return;

      // In demo mode, just show the message without sending
      if (isDemo) {
        const messageId = `msg-${Date.now()}`;
        const userMessage: Message = {
          id: messageId,
          role: "user",
          content: content.trim(),
          timestamp: new Date(),
          status: "sent",
        };
        setMessages((prev) => [...prev, userMessage]);
        setInputValue("");

        // Simulate a demo response after a short delay
        setTimeout(() => {
          const activeAgent = config?.agentsList?.[0];
          setMessages((prev) => [
            ...prev,
            {
              id: `response-${Date.now()}`,
              role: "assistant",
              content: "This is a preview mode. Messages are not sent to the AI agent.",
              timestamp: new Date(),
              status: "sent",
              agentId: activeAgent?.id,
              agentName: activeAgent?.name,
              agentAvatarUrl: activeAgent?.avatarUrl,
              agentColor: activeAgent?.color,
            },
          ]);
        }, 500);
        return;
      }

      if (!session) return;

      const messageId = `msg-${Date.now()}`;
      const responseId = `response-${Date.now()}`;

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
      // Only show AI typing indicator if not in human handling mode
      const isHumanHandling = isWaitingForHuman || isWithHuman;
      if (!isHumanHandling) {
        _setIsTyping(true);
      }
      setIsSending(true);
      // Don't set thinkingState here - only set it when actual thinking/tool events arrive
      setThinkingState(null);

      // Add placeholder for streaming response (only if AI will respond)
      let currentActiveAgentId = activeAgentId;
      const getActiveAgent = () =>
        config?.agentsList?.find((a) => a.id === currentActiveAgentId);

      // Only add streaming placeholder if AI will respond (not during human handling)
      if (!isHumanHandling) {
        setMessages((prev) => [
          ...prev,
          {
            id: responseId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
            status: "sending",
            agentId: currentActiveAgentId || undefined,
            agentName: getActiveAgent()?.name,
            agentAvatarUrl: getActiveAgent()?.avatarUrl,
            agentColor: getActiveAgent()?.color,
          },
        ]);
        setStreamingMessageId(responseId);
      }

      try {
        const response = await fetch(
          `/api/widget/${session.sessionId}/message`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: content.trim() }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        // Read the streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        // Track accumulated content for debugging (accumulated value unused after loop)
        let _streamedContentDebug = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          let currentEventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEventType = line.slice(7).trim();
            } else if (line.startsWith("data: ") && currentEventType) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);

                // Log SSE events for debugging (skip delta to reduce noise)
                if (currentEventType !== "delta") {
                  console.log(`[SSE ${currentEventType}]`, data);
                }

                // Handle each event type
                switch (currentEventType) {
                  case "ack":
                    // Update user message status
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === messageId ? { ...msg, status: "sent" } : msg
                      )
                    );
                    break;

                  case "thinking":
                    _setIsTyping(true);
                    // Only show ThinkingBubble for actual AI thinking, not status messages
                    // Status messages like "Generating response", "Initializing agent..."
                    // should just show the typing indicator
                    const thinkingText = data.content || data.step;
                    const isStatusMessage = thinkingText && (
                      thinkingText.toLowerCase().includes("generating") ||
                      thinkingText.toLowerCase().includes("initializing") ||
                      thinkingText.toLowerCase().includes("processing") ||
                      thinkingText === "Thinking..."
                    );

                    if (!isStatusMessage && config?.showThinking !== false && thinkingText) {
                      setThinkingState((prev) => ({
                        ...prev,
                        text: thinkingText,
                      }));
                    }
                    break;

                  case "tool_call":
                    // Always update thinkingState for tool calls
                    // Map SSE status values to ThinkingBubble expected values
                    const toolStatus = data.status === "executing" ? "running"
                      : data.status === "completed" ? "completed"
                      : data.status || "running";

                    setThinkingState((prev) => ({
                      ...prev,
                      // Update thinking text with notification if provided
                      text: data.notification || prev?.text,
                      toolCalls: config?.showThinking
                        ? [
                            ...(prev?.toolCalls || []).filter(
                              (t) => t.name !== data.toolName
                            ),
                            {
                              name: data.toolName,
                              status: toolStatus,
                              args: data.arguments,
                              notification: data.notification,
                            },
                          ]
                        : prev?.toolCalls,
                    }));
                    break;

                  case "notification":
                    if (data.message && data.targetAgentId) {
                      // Check if the target agent is already visible
                      const isAgentAlreadyVisible = visibleAgents.has(data.targetAgentId);

                      // Add new agent to visible agents (will persist even after this transfer)
                      if (!isAgentAlreadyVisible) {
                        setVisibleAgents((prev) => new Set([...prev, data.targetAgentId]));
                      }

                      // Update active agent
                      currentActiveAgentId = data.targetAgentId;
                      setActiveAgentId(data.targetAgentId);

                      // Only show transfer bubble if agent was NOT already visible
                      // and showAgentSwitchNotification is enabled
                      if (!isAgentAlreadyVisible && config?.showAgentSwitchNotification !== false) {
                        // Get previous agent - fallback to supervisor if none
                        const previousAgentId = data.previousAgentId;
                        const previousAgent = previousAgentId
                          ? config?.agentsList?.find(
                              (a) => a.id === previousAgentId
                            )
                          : config?.agentsList?.find(
                              (a) => a.type === "supervisor"
                            ) || config?.agentsList?.[0];

                        // Get new agent info
                        const newAgent = config?.agentsList?.find(
                          (a) => a.id === data.targetAgentId
                        );

                        // Insert transfer notification BEFORE the streaming placeholder
                        // so the response appears AFTER the transfer bubble
                        setMessages((prev) => {
                          const streamingIdx = prev.findIndex(
                            (m) => m.id === responseId
                          );

                          const transferMsg: Message = {
                            id: `transfer-${Date.now()}`,
                            role: "system",
                            content: data.message,
                            timestamp: new Date(),
                            isNotification: true,
                            isTransfer: true,
                            targetAgentId: data.targetAgentId,
                            targetAgentName: newAgent?.name || data.targetAgentName,
                            targetAgentAvatarUrl:
                              newAgent?.avatarUrl || data.targetAgentAvatarUrl,
                            targetAgentDesignation:
                              newAgent?.designation || data.targetAgentDesignation,
                            previousAgentId:
                              previousAgent?.id || data.previousAgentId,
                            previousAgentName:
                              previousAgent?.name || data.previousAgentName,
                            previousAgentAvatarUrl:
                              previousAgent?.avatarUrl || data.previousAgentAvatarUrl,
                          };

                          if (streamingIdx === -1) {
                            // No streaming placeholder, just append
                            return [...prev, transferMsg];
                          }

                          // Insert transfer before the streaming placeholder
                          // Also update the placeholder with new agent info
                          const streamingMsg = prev[streamingIdx];
                          const updatedStreamingMsg = streamingMsg ? {
                            ...streamingMsg,
                            agentId: data.targetAgentId || streamingMsg.agentId,
                            agentName: newAgent?.name || streamingMsg.agentName,
                            agentAvatarUrl: newAgent?.avatarUrl || streamingMsg.agentAvatarUrl,
                            agentColor: newAgent?.color || streamingMsg.agentColor,
                          } : null;

                          return [
                            ...prev.slice(0, streamingIdx),
                            transferMsg,
                            ...(updatedStreamingMsg ? [updatedStreamingMsg] : []),
                            ...prev.slice(streamingIdx + 1),
                          ];
                        });
                      }
                    }
                    break;

                  case "human_escalation":
                    // Human escalation requested - show waiting bubble
                    setIsWaitingForHuman(true);
                    setThinkingState(null);
                    _setIsTyping(false);

                    // Remove the streaming placeholder and add the waiting bubble
                    setMessages((prev) => {
                      const streamingIdx = prev.findIndex((m) => m.id === responseId);
                      const filteredMessages = streamingIdx !== -1
                        ? [...prev.slice(0, streamingIdx), ...prev.slice(streamingIdx + 1)]
                        : prev;

                      return [
                        ...filteredMessages,
                        {
                          id: `human-waiting-${Date.now()}`,
                          role: "system",
                          content: data.reason || "Connecting you with a human agent",
                          timestamp: new Date(),
                          isHumanWaiting: true,
                          previousAgentId: data.initiatingAgentId,
                          previousAgentName: data.initiatingAgentName,
                          escalationReason: data.reason,
                        },
                      ];
                    });
                    break;

                  case "human_joined":
                    // Human agent joined the conversation
                    setIsWaitingForHuman(false);
                    setIsWithHuman(true);
                    setCurrentHumanAgent({
                      id: data.humanAgentId,
                      name: data.humanAgentName,
                      avatarUrl: data.humanAgentAvatarUrl,
                    });

                    // Remove waiting bubble and add joined bubble
                    setMessages((prev) => {
                      // Remove any waiting bubble
                      const filtered = prev.filter((m) => !m.isHumanWaiting);

                      return [
                        ...filtered,
                        {
                          id: `human-joined-${Date.now()}`,
                          role: "system",
                          content: `${data.humanAgentName} joined the conversation`,
                          timestamp: new Date(),
                          isHumanJoined: true,
                          humanAgentId: data.humanAgentId,
                          humanAgentName: data.humanAgentName,
                          humanAgentAvatarUrl: data.humanAgentAvatarUrl,
                          previousAgentId: activeAgentId || undefined,
                        },
                      ];
                    });
                    break;

                  case "human_exited":
                    // Human agent left the conversation
                    setIsWithHuman(false);
                    const exitedAgent = currentHumanAgent;
                    setCurrentHumanAgent(null);

                    // Add exited bubble
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `human-exited-${Date.now()}`,
                        role: "system",
                        content: `${exitedAgent?.name || data.humanAgentName || "Support agent"} left the conversation`,
                        timestamp: new Date(),
                        isHumanExited: true,
                        humanAgentId: exitedAgent?.id || data.humanAgentId,
                        humanAgentName: exitedAgent?.name || data.humanAgentName,
                        humanAgentAvatarUrl: exitedAgent?.avatarUrl || data.humanAgentAvatarUrl,
                      },
                    ]);
                    break;

                  case "delta":
                    // Clear thinking state when content starts streaming
                    setThinkingState(null);

                    // Skip if instant updates disabled
                    if (config?.showInstantUpdates === false) {
                      _streamedContentDebug += data.content;
                      break;
                    }

                    _streamedContentDebug += data.content;
                    const deltaActiveAgent = getActiveAgent();

                    setMessages((prev) => {
                      // Find the streaming message by responseId, not just the last message
                      // This is important because notification messages may come after the placeholder
                      const streamingIdx = prev.findIndex(
                        (m) => m.id === responseId && m.role === "assistant"
                      );

                      if (streamingIdx === -1) return prev;

                      const streamingMsg = prev[streamingIdx];
                      if (!streamingMsg) return prev;

                      return [
                        ...prev.slice(0, streamingIdx),
                        {
                          ...streamingMsg,
                          content: streamingMsg.content + data.content,
                          agentId: currentActiveAgentId || streamingMsg.agentId,
                          agentName: deltaActiveAgent?.name || streamingMsg.agentName,
                          agentAvatarUrl:
                            deltaActiveAgent?.avatarUrl || streamingMsg.agentAvatarUrl,
                          agentColor:
                            deltaActiveAgent?.color || streamingMsg.agentColor,
                        },
                        ...prev.slice(streamingIdx + 1),
                      ];
                    });
                    break;

                  case "complete":
                    setThinkingState(null);
                    const completeActiveAgent = getActiveAgent();

                    setMessages((prev) => {
                      // Find the streaming message by responseId
                      const streamingIdx = prev.findIndex(
                        (m) => m.id === responseId && m.role === "assistant"
                      );

                      if (streamingIdx === -1) return prev;

                      const streamingMsg = prev[streamingIdx];
                      if (!streamingMsg) return prev;

                      return [
                        ...prev.slice(0, streamingIdx),
                        {
                          ...streamingMsg,
                          id: data.messageId || streamingMsg.id,
                          content: data.content,
                          status: "sent" as const,
                          agentId: data.agentId || currentActiveAgentId || streamingMsg.agentId,
                          agentName:
                            data.agentName || completeActiveAgent?.name || streamingMsg.agentName,
                          agentAvatarUrl:
                            data.agentAvatarUrl ||
                            completeActiveAgent?.avatarUrl ||
                            streamingMsg.agentAvatarUrl,
                          agentColor:
                            completeActiveAgent?.color || streamingMsg.agentColor,
                        },
                        ...prev.slice(streamingIdx + 1),
                      ];
                    });

                    if (data.agentId) {
                      setActiveAgentId(data.agentId);
                    }
                    break;

                  case "human_handling":
                    // Human is handling the conversation - clear AI typing indicators
                    _setIsTyping(false);
                    setIsSending(false);
                    setThinkingState(null);
                    // Remove the streaming placeholder message since AI won't respond
                    setMessages((prev) =>
                      prev.filter((m) => m.id !== responseId)
                    );
                    setStreamingMessageId(null);
                    break;

                  case "done":
                    _setIsTyping(false);
                    setIsSending(false);
                    setStreamingMessageId(null);
                    setThinkingState(null);

                    const doneActiveAgent = getActiveAgent();

                    // Finalize the message with database ID - find by responseId
                    setMessages((prev) => {
                      const streamingIdx = prev.findIndex(
                        (m) => m.id === responseId && m.role === "assistant"
                      );

                      if (streamingIdx === -1) return prev;

                      const streamingMsg = prev[streamingIdx];
                      if (!streamingMsg) return prev;

                      return [
                        ...prev.slice(0, streamingIdx),
                        {
                          ...streamingMsg,
                          id: data.messageId || streamingMsg.id,
                          content: data.content || streamingMsg.content,
                          status: "sent" as const,
                          agentId: currentActiveAgentId || streamingMsg.agentId,
                          agentName: doneActiveAgent?.name || streamingMsg.agentName,
                          agentAvatarUrl:
                            doneActiveAgent?.avatarUrl || streamingMsg.agentAvatarUrl,
                          agentColor: doneActiveAgent?.color || streamingMsg.agentColor,
                        },
                        ...prev.slice(streamingIdx + 1),
                      ];
                    });

                    notifyParent("widget:message", {
                      role: "assistant",
                      content: data.content,
                    });
                    break;

                  case "error":
                    console.error("Stream error:", data);
                    setError(data.message || "Failed to process message");
                    _setIsTyping(false);
                    setIsSending(false);
                    setStreamingMessageId(null);
                    setThinkingState(null);
                    break;

                  case "auth_required":
                    // Authentication required for agent/tool access
                    console.log("[Auth] Authentication required:", data);
                    _setIsTyping(false);
                    setIsSending(false);
                    setThinkingState(null);

                    // Update auth state
                    setAuthState({
                      isRequired: true,
                      isAuthenticated: false,
                      currentStep: {
                        stepId: data.stepId,
                        stepName: data.stepName,
                        fields: data.fields || [],
                        aiPrompt: data.aiPrompt,
                      },
                      targetAgentId: data.targetAgentId,
                      targetAgentName: data.targetAgentName,
                    });

                    // Store the last user message for auto-resend after auth
                    setMessages((prev) => {
                      // Find the last user message (the one that triggered auth)
                      const lastUserMessage = [...prev].reverse().find((m) => m.role === "user");
                      if (lastUserMessage?.content) {
                        setPendingAuthMessage(lastUserMessage.content);
                      }

                      const streamingIdx = prev.findIndex((m) => m.id === responseId);
                      const filteredMessages = streamingIdx !== -1
                        ? [...prev.slice(0, streamingIdx), ...prev.slice(streamingIdx + 1)]
                        : prev;

                      return [
                        ...filteredMessages,
                        {
                          id: `auth-required-${Date.now()}`,
                          role: "system" as const,
                          content: data.aiPrompt || "Please log in to continue.",
                          timestamp: new Date(),
                          isAuthRequired: true,
                          authStepId: data.stepId,
                          authFields: data.fields || [],
                          authPrompt: data.aiPrompt,
                          targetAgentId: data.targetAgentId,
                          targetAgentName: data.targetAgentName,
                        },
                      ];
                    });
                    break;

                  case "auth_success":
                    // Authentication successful
                    console.log("[Auth] Authentication successful:", data);
                    setAuthState((prev) => ({
                      ...prev,
                      isRequired: false,
                      isAuthenticated: true,
                      currentStep: undefined,
                      error: undefined,
                      isSubmitting: false,
                    }));

                    // Add success message
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `auth-success-${Date.now()}`,
                        role: "system" as const,
                        content: data.message || `Welcome${data.userName ? `, ${data.userName}` : ""}! You're now logged in.`,
                        timestamp: new Date(),
                      },
                    ]);
                    break;

                  case "auth_error":
                    // Authentication failed
                    console.error("[Auth] Authentication error:", data);
                    setAuthState((prev) => ({
                      ...prev,
                      error: data.error || "Authentication failed",
                      isSubmitting: false,
                    }));
                    break;

                  case "auth_step":
                    // Move to next auth step (multi-step auth)
                    console.log("[Auth] Next auth step:", data);
                    setAuthState((prev) => ({
                      ...prev,
                      currentStep: {
                        stepId: data.stepId,
                        stepName: data.stepName,
                        fields: data.fields || [],
                        aiPrompt: data.aiPrompt,
                      },
                      error: undefined,
                      isSubmitting: false,
                    }));

                    // Update the auth message
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `auth-step-${Date.now()}`,
                        role: "system" as const,
                        content: data.aiPrompt || "Please continue with verification.",
                        timestamp: new Date(),
                        isAuthRequired: true,
                        authStepId: data.stepId,
                        authFields: data.fields || [],
                        authPrompt: data.aiPrompt,
                      },
                    ]);
                    break;

                  case "permission_denied":
                    // Permission denied (role-based access)
                    console.warn("[Auth] Permission denied:", data);
                    _setIsTyping(false);
                    setIsSending(false);
                    setThinkingState(null);

                    // Replace streaming placeholder with permission denied message
                    setMessages((prev) => {
                      const streamingIdx = prev.findIndex((m) => m.id === responseId);
                      const filteredMessages = streamingIdx !== -1
                        ? [...prev.slice(0, streamingIdx), ...prev.slice(streamingIdx + 1)]
                        : prev;

                      return [
                        ...filteredMessages,
                        {
                          id: `permission-denied-${Date.now()}`,
                          role: "system" as const,
                          content: data.reason || "You don't have permission to access this feature.",
                          timestamp: new Date(),
                        },
                      ];
                    });
                    break;

                  case "logout_success":
                    // User logged out successfully
                    console.log("[Auth] Logout successful:", data);
                    // Clear auth state
                    setAuthState({
                      isRequired: false,
                      isAuthenticated: false,
                    });
                    // Clear any pending auth message
                    setPendingAuthMessage(null);
                    break;
                }
              } catch {
                // Ignore parse errors
              }
              currentEventType = "";
            }
          }
        }

        // Ensure final state is clean
        _setIsTyping(false);
        setIsSending(false);
        setStreamingMessageId(null);
        setThinkingState(null);
      } catch {
        // Mark as error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, status: "error" } : msg
          )
        );
        // Remove streaming placeholder
        setMessages((prev) => prev.filter((m) => m.id !== responseId));
        setError("Failed to send message");
        _setIsTyping(false);
        setIsSending(false);
        setStreamingMessageId(null);
        setThinkingState(null);
      }
    },
    [session, config, activeAgentId, isDemo, visibleAgents]
  );

  // Keep sendMessageRef in sync for voice recording callback
  useEffect(() => {
    sendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  // Handle voice message sending
  const handleSendVoiceMessage = useCallback(
    async (audioBlob: Blob, duration: number) => {
      console.log("[Voice] Sending voice message, blob size:", audioBlob.size, "duration:", duration, "session:", session?.sessionId);
      if (isDemo) {
        console.log("[Voice] Demo mode, skipping voice message");
        return;
      }
      if (!session) {
        console.error("[Voice] No session available, cannot send voice message");
        setError("Session not initialized. Please refresh and try again.");
        return;
      }

      const messageId = `voice-${Date.now()}`;
      const responseId = `response-${Date.now()}`;

      // Add user voice message (content will be updated with transcript after ack)
      const userMessage: Message = {
        id: messageId,
        role: "user",
        content: "", // Will be filled with transcript from server
        type: "audio",
        duration,
        timestamp: new Date(),
        status: "sending",
      };

      setMessages((prev) => [...prev, userMessage]);
      _setIsTyping(true);
      setIsSendingVoice(true);
      setThinkingState(null);

      // Add placeholder for streaming response
      let currentActiveAgentId = activeAgentId;
      const getActiveAgent = () =>
        config?.agentsList?.find((a) => a.id === currentActiveAgentId);

      setMessages((prev) => [
        ...prev,
        {
          id: responseId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          status: "sending",
          agentId: currentActiveAgentId || undefined,
          agentName: getActiveAgent()?.name,
          agentAvatarUrl: getActiveAgent()?.avatarUrl,
          agentColor: getActiveAgent()?.color,
        },
      ]);
      setStreamingMessageId(responseId);

      try {
        // Send voice message via FormData
        const formData = new FormData();
        const extension = audioBlob.type.includes("webm") ? "webm" : "mp4";
        formData.append("audio", audioBlob, `recording.${extension}`);
        formData.append("duration", duration.toString());

        const response = await fetch(
          `/api/widget/${session.sessionId}/message`,
          {
            method: "POST",
            body: formData, // No Content-Type header - browser sets it with boundary
          }
        );

        if (!response.ok) {
          throw new Error("Failed to send voice message");
        }

        // Read the streaming response (same as text messages)
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        // Track accumulated content for debugging (accumulated value unused after loop)
        let _streamedContentDebug = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEventType = line.slice(7).trim();
            } else if (line.startsWith("data: ") && currentEventType) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);

                switch (currentEventType) {
                  case "ack":
                    // Update user voice message with transcript and audio URL
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === messageId
                          ? {
                              ...msg,
                              status: "sent",
                              content: data.transcript || "",
                              transcript: data.transcript || "",
                              audioUrl: data.audioUrl,
                              duration: data.duration || duration,
                            }
                          : msg
                      )
                    );
                    // Re-enable input after transcription complete
                    // User can now type while waiting for LLM response
                    setIsSendingVoice(false);
                    break;

                  case "thinking":
                    _setIsTyping(true);
                    const thinkingText = data.content || data.step;
                    const isStatusMessage =
                      thinkingText &&
                      (thinkingText.toLowerCase().includes("generating") ||
                        thinkingText.toLowerCase().includes("initializing") ||
                        thinkingText.toLowerCase().includes("processing") ||
                        thinkingText === "Thinking...");

                    if (
                      !isStatusMessage &&
                      config?.showThinking !== false &&
                      thinkingText
                    ) {
                      setThinkingState((prev) => ({
                        ...prev,
                        text: thinkingText,
                      }));
                    }
                    break;

                  case "tool_call":
                    const toolStatus =
                      data.status === "executing"
                        ? "running"
                        : data.status === "completed"
                          ? "completed"
                          : data.status || "running";

                    setThinkingState((prev) => ({
                      ...prev,
                      text: data.notification || prev?.text,
                      toolCalls:
                        config?.showThinking
                          ? [
                              ...(prev?.toolCalls || []).filter(
                                (t) => t.name !== data.toolName
                              ),
                              {
                                name: data.toolName,
                                status: toolStatus,
                                args: data.arguments,
                                notification: data.notification,
                              },
                            ]
                          : prev?.toolCalls,
                    }));
                    break;

                  case "notification":
                    if (data.message && data.targetAgentId) {
                      const isAgentAlreadyVisible = visibleAgents.has(
                        data.targetAgentId
                      );

                      if (!isAgentAlreadyVisible) {
                        setVisibleAgents(
                          (prev) => new Set([...prev, data.targetAgentId])
                        );
                      }

                      currentActiveAgentId = data.targetAgentId;
                      setActiveAgentId(data.targetAgentId);

                      if (
                        !isAgentAlreadyVisible &&
                        config?.showAgentSwitchNotification !== false
                      ) {
                        const previousAgentId = data.previousAgentId;
                        const previousAgent = previousAgentId
                          ? config?.agentsList?.find(
                              (a) => a.id === previousAgentId
                            )
                          : config?.agentsList?.find(
                              (a) => a.type === "supervisor"
                            ) || config?.agentsList?.[0];

                        const newAgent = config?.agentsList?.find(
                          (a) => a.id === data.targetAgentId
                        );

                        setMessages((prev) => {
                          const streamingIdx = prev.findIndex(
                            (m) => m.id === responseId
                          );

                          const transferMsg: Message = {
                            id: `transfer-${Date.now()}`,
                            role: "system",
                            content: data.message,
                            timestamp: new Date(),
                            isNotification: true,
                            isTransfer: true,
                            targetAgentId: data.targetAgentId,
                            targetAgentName:
                              newAgent?.name || data.targetAgentName,
                            targetAgentAvatarUrl:
                              newAgent?.avatarUrl || data.targetAgentAvatarUrl,
                            targetAgentDesignation:
                              newAgent?.designation ||
                              data.targetAgentDesignation,
                            previousAgentId:
                              previousAgent?.id || data.previousAgentId,
                            previousAgentName:
                              previousAgent?.name || data.previousAgentName,
                            previousAgentAvatarUrl:
                              previousAgent?.avatarUrl ||
                              data.previousAgentAvatarUrl,
                          };

                          if (streamingIdx === -1) {
                            return [...prev, transferMsg];
                          }

                          const streamingMsg = prev[streamingIdx];
                          const updatedStreamingMsg = streamingMsg
                            ? {
                                ...streamingMsg,
                                agentId:
                                  data.targetAgentId || streamingMsg.agentId,
                                agentName:
                                  newAgent?.name || streamingMsg.agentName,
                                agentAvatarUrl:
                                  newAgent?.avatarUrl ||
                                  streamingMsg.agentAvatarUrl,
                                agentColor:
                                  newAgent?.color || streamingMsg.agentColor,
                              }
                            : null;

                          return [
                            ...prev.slice(0, streamingIdx),
                            transferMsg,
                            ...(updatedStreamingMsg
                              ? [updatedStreamingMsg]
                              : []),
                            ...prev.slice(streamingIdx + 1),
                          ];
                        });
                      }
                    }
                    break;

                  case "delta":
                    setThinkingState(null);

                    if (config?.showInstantUpdates === false) {
                      _streamedContentDebug += data.content;
                      break;
                    }

                    _streamedContentDebug += data.content;
                    const deltaActiveAgent = getActiveAgent();

                    setMessages((prev) => {
                      const streamingIdx = prev.findIndex(
                        (m) => m.id === responseId && m.role === "assistant"
                      );

                      if (streamingIdx === -1) return prev;

                      const streamingMsg = prev[streamingIdx];
                      if (!streamingMsg) return prev;

                      return [
                        ...prev.slice(0, streamingIdx),
                        {
                          ...streamingMsg,
                          content: streamingMsg.content + data.content,
                          agentId:
                            currentActiveAgentId || streamingMsg.agentId,
                          agentName:
                            deltaActiveAgent?.name || streamingMsg.agentName,
                          agentAvatarUrl:
                            deltaActiveAgent?.avatarUrl ||
                            streamingMsg.agentAvatarUrl,
                          agentColor:
                            deltaActiveAgent?.color || streamingMsg.agentColor,
                        },
                        ...prev.slice(streamingIdx + 1),
                      ];
                    });
                    break;

                  case "complete":
                    setThinkingState(null);
                    const completeActiveAgent = getActiveAgent();

                    setMessages((prev) => {
                      const streamingIdx = prev.findIndex(
                        (m) => m.id === responseId && m.role === "assistant"
                      );

                      if (streamingIdx === -1) return prev;

                      const streamingMsg = prev[streamingIdx];
                      if (!streamingMsg) return prev;

                      return [
                        ...prev.slice(0, streamingIdx),
                        {
                          ...streamingMsg,
                          id: data.messageId || streamingMsg.id,
                          content: data.content,
                          status: "sent" as const,
                          agentId:
                            data.agentId ||
                            currentActiveAgentId ||
                            streamingMsg.agentId,
                          agentName:
                            data.agentName ||
                            completeActiveAgent?.name ||
                            streamingMsg.agentName,
                          agentAvatarUrl:
                            data.agentAvatarUrl ||
                            completeActiveAgent?.avatarUrl ||
                            streamingMsg.agentAvatarUrl,
                          agentColor:
                            completeActiveAgent?.color ||
                            streamingMsg.agentColor,
                        },
                        ...prev.slice(streamingIdx + 1),
                      ];
                    });

                    if (data.agentId) {
                      setActiveAgentId(data.agentId);
                    }
                    break;

                  case "human_handling":
                    // Human is handling the conversation - clear typing indicators
                    _setIsTyping(false);
                    setIsSendingVoice(false);
                    setThinkingState(null);
                    // Remove the streaming placeholder message since AI won't respond
                    setMessages((prev) =>
                      prev.filter((m) => m.id !== responseId)
                    );
                    setStreamingMessageId(null);
                    break;

                  case "done":
                    _setIsTyping(false);
                    setIsSendingVoice(false);
                    setStreamingMessageId(null);
                    setThinkingState(null);

                    const doneActiveAgent = getActiveAgent();

                    setMessages((prev) => {
                      const streamingIdx = prev.findIndex(
                        (m) => m.id === responseId && m.role === "assistant"
                      );

                      if (streamingIdx === -1) return prev;

                      const streamingMsg = prev[streamingIdx];
                      if (!streamingMsg) return prev;

                      return [
                        ...prev.slice(0, streamingIdx),
                        {
                          ...streamingMsg,
                          id: data.messageId || streamingMsg.id,
                          content: data.content || streamingMsg.content,
                          status: "sent" as const,
                          agentId:
                            currentActiveAgentId || streamingMsg.agentId,
                          agentName:
                            doneActiveAgent?.name || streamingMsg.agentName,
                          agentAvatarUrl:
                            doneActiveAgent?.avatarUrl ||
                            streamingMsg.agentAvatarUrl,
                          agentColor:
                            doneActiveAgent?.color || streamingMsg.agentColor,
                        },
                        ...prev.slice(streamingIdx + 1),
                      ];
                    });

                    notifyParent("widget:message", {
                      role: "assistant",
                      content: data.content,
                    });
                    break;

                  case "error":
                    console.error("Voice stream error:", data);
                    // Handle voice recording errors - show as agent message
                    if (data.code === "SILENT_AUDIO" || data.code === "RECORDING_TOO_SHORT") {
                      // Remove the pending voice message
                      setMessages((prev) => prev.filter((m) => m.id !== messageId));
                      // Get active agent info for the message
                      const errorActiveAgent =
                        config?.agentsList?.find((a) => a.id === activeAgentId) ||
                        config?.agentsList?.[0];
                      // Replace streaming placeholder with error message from agent
                      setMessages((prev) => [
                        ...prev.filter((m) => m.id !== responseId),
                        {
                          id: `error-${Date.now()}`,
                          role: "assistant",
                          content: data.message,
                          timestamp: new Date(),
                          status: "sent",
                          agentId: errorActiveAgent?.id,
                          agentName: errorActiveAgent?.name,
                          agentAvatarUrl: errorActiveAgent?.avatarUrl,
                          agentColor: errorActiveAgent?.color,
                        },
                      ]);
                    } else {
                      setError(data.message || "Failed to process voice message");
                    }
                    _setIsTyping(false);
                    setIsSendingVoice(false);
                    setStreamingMessageId(null);
                    setThinkingState(null);
                    break;
                }
              } catch {
                // Ignore parse errors
              }
              currentEventType = "";
            }
          }
        }

        // Ensure final state is clean
        _setIsTyping(false);
        setIsSendingVoice(false);
        setStreamingMessageId(null);
        setThinkingState(null);
      } catch {
        // Mark user message as error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, status: "error" } : msg
          )
        );
        // Remove streaming placeholder
        setMessages((prev) => prev.filter((m) => m.id !== responseId));
        setError("Failed to send voice message");
        _setIsTyping(false);
        setIsSendingVoice(false);
        setStreamingMessageId(null);
        setThinkingState(null);
      }
    },
    [session, config, activeAgentId, isDemo, visibleAgents]
  );

  // Handle voice recording completion (PTT release)
  const handleVoiceRecordingStop = useCallback(async () => {
    // Only proceed if we're actually recording or starting to record
    if (!isRecording && !isVoiceStarting) {
      return;
    }

    console.log("[Voice] Stopping recording, duration:", recordingDuration);
    const audioBlob = await stopRecording();
    console.log("[Voice] Recording stopped, blob:", audioBlob ? `${audioBlob.size} bytes, type: ${audioBlob.type}` : "null");

    if (audioBlob && audioBlob.size > 0) {
      handleSendVoiceMessage(audioBlob, recordingDuration);
    } else if (!audioBlob) {
      console.log("[Voice] No audio blob - recording may have been too short (try holding the button longer)");
    } else {
      console.log("[Voice] Audio blob is empty");
    }
  }, [isRecording, isVoiceStarting, stopRecording, recordingDuration, handleSendVoiceMessage]);

  // Handle PTT button click - show help message and start recording
  const handlePttClick = useCallback(() => {
    // If help is showing, hide it and toggle off
    if (showPttHelp) {
      setShowPttHelp(false);
      if (pttHelpTimeoutRef.current) {
        clearTimeout(pttHelpTimeoutRef.current);
        pttHelpTimeoutRef.current = null;
      }
      return;
    }

    // Show help message
    setShowPttHelp(true);

    // Clear any existing timeout
    if (pttHelpTimeoutRef.current) {
      clearTimeout(pttHelpTimeoutRef.current);
    }

    // Hide after 3 seconds
    pttHelpTimeoutRef.current = setTimeout(() => {
      setShowPttHelp(false);
      pttHelpTimeoutRef.current = null;
    }, 3000);

    // Start recording
    startRecording();
  }, [showPttHelp, startRecording]);

  // Handle cancel escalation - return to AI mode
  const handleCancelEscalation = useCallback(async () => {
    if (!session) {
      console.error("Cancel escalation: No session available");
      return;
    }

    try {
      const response = await fetch(`/api/widget/${session.sessionId}/cancel-escalation`, {
        method: "POST",
      });

      if (response.ok) {
        setIsWaitingForHuman(false);
        // Remove waiting bubble from messages
        setMessages((prev) => prev.filter((m) => !m.isHumanWaiting));
      } else {
        // Log the error for debugging
        const errorData = await response.json().catch(() => ({}));
        console.error("Cancel escalation failed:", response.status, errorData);

        // If status check fails (e.g., conversation not in waiting_human state),
        // still remove the waiting bubble from UI as a fallback
        if (response.status === 400) {
          setIsWaitingForHuman(false);
          setMessages((prev) => prev.filter((m) => !m.isHumanWaiting));
        }
      }
    } catch (error) {
      console.error("Failed to cancel escalation:", error);
    }
  }, [session]);

  // Hide PTT help when recording actually starts
  useEffect(() => {
    if (isRecording && showPttHelp) {
      setShowPttHelp(false);
      if (pttHelpTimeoutRef.current) {
        clearTimeout(pttHelpTimeoutRef.current);
        pttHelpTimeoutRef.current = null;
      }
    }
  }, [isRecording, showPttHelp]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (pttHelpTimeoutRef.current) {
        clearTimeout(pttHelpTimeoutRef.current);
      }
    };
  }, []);

  // Keep visibleAgentsRef in sync for SSE callback
  useEffect(() => {
    visibleAgentsRef.current = visibleAgents;
  }, [visibleAgents]);

  // Handle global mouse/touch release for PTT recording
  // When recording starts, the UI switches from mic button to waveform,
  // removing the button that had onMouseUp. This ensures we still capture the release.
  useEffect(() => {
    if (isRecording) {
      const handleGlobalRelease = () => {
        handleVoiceRecordingStop();
      };

      // Listen for mouse/touch release anywhere on document
      document.addEventListener("mouseup", handleGlobalRelease);
      document.addEventListener("touchend", handleGlobalRelease);

      return () => {
        document.removeEventListener("mouseup", handleGlobalRelease);
        document.removeEventListener("touchend", handleGlobalRelease);
      };
    }
  }, [isRecording, handleVoiceRecordingStop]);

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

  // Auto-resize textarea based on content (max 3 lines)
  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";

    // Calculate max height: 3 lines × 20px line-height + 16px padding (8px top + 8px bottom)
    const lineHeight = 20;
    const maxLines = 3;
    const padding = 16;
    const maxHeight = lineHeight * maxLines + padding;

    // Set height to scrollHeight but cap at maxHeight
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, []);

  // Adjust textarea height when input value changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleClose = () => {
    notifyParent("widget:close", {});
  };

  const handleMinimize = () => {
    notifyParent("widget:minimize", {});
  };

  const handleNewChat = () => {
    // 1. Close existing SSE connection
    eventSourceRef.current?.close();

    // 2. Clear localStorage (both session and conversation)
    if (config) {
      try {
        localStorage.removeItem(`buzzi_widget_${config.agentId}_session`);
        localStorage.removeItem(`buzzi_widget_${config.agentId}_conversation`);
      } catch {
        // localStorage not available
      }
    }

    // 3. Reset states
    setSession(null);
    setIsInitializingSession(false);
    setActiveAgentId(null);
    setVisibleAgents(new Set());
    setThinkingState(null);
    _setIsTyping(false);
    setIsSending(false);
    setStreamingMessageId(null);
    animatedAgentsRef.current = new Set();

    // 4. Reset messages with welcome message if configured
    if (config?.welcomeMessage) {
      const firstAgent = config.agentsList?.[0];
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: config.welcomeMessage,
        timestamp: new Date(),
        agentId: firstAgent?.id,
        agentName: firstAgent?.name,
        agentAvatarUrl: firstAgent?.avatarUrl,
        agentColor: firstAgent?.color,
      }]);
    } else {
      setMessages([]);
    }

    // 5. Re-set first agent as active for multi-agent
    if (config?.isMultiAgent && config?.agentsList?.length) {
      const firstAgentId = config.agentsList[0]?.id;
      if (firstAgentId) {
        setActiveAgentId(firstAgentId);
        setVisibleAgents(new Set([firstAgentId]));
      }
    }

    // Session will be auto-created by the useEffect since session is now null
  };

  const handlePreChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!config) return;

    // Validate email if required
    if (config.requireEmail && preChatEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(preChatEmail)) {
        return; // Invalid email
      }
    }

    // Update customer in config
    const customer = {
      ...config.customer,
      name: preChatName || undefined,
      email: preChatEmail || undefined,
    };

    // Save to localStorage
    const storageKey = `buzzi_widget_${config.agentId}_customer`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(customer));
    } catch {
      // localStorage not available
    }

    setConfig((prev) => prev ? { ...prev, customer } : null);
    setShowPreChatForm(false);
    setPreChatSubmitted(true);
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const notifyParent = (type: string, data: unknown) => {
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({ type, data }, "*");
    }
  };

  const getAgentInfo = (agentId?: string): AgentInfo | undefined => {
    if (!config?.agentsList || !agentId) return undefined;
    return config.agentsList.find((a) => a.id === agentId);
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (error && !config) {
    return (
      <div className={cn("flex h-full items-center justify-center p-4 text-center text-muted-foreground", className)} style={style}>
        <p>{error}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)} style={style}>
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: `#007bff transparent transparent transparent` }}
        />
      </div>
    );
  }

  const isDark = config.theme === "dark";
  const borderRadius = config.borderRadius ?? 16;
  const accentColor = config.accentColor || config.primaryColor;

  // Call-only mode: render only the call interface
  if (isCallOnlyMode) {
    return (
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden",
          isDark ? "bg-zinc-900 text-white" : "bg-white text-zinc-900",
          className
        )}
        style={{
          borderRadius: `${borderRadius}px`,
          ...style,
        }}
      >
        <CallDialog
          isOpen={true}
          onClose={() => {
            // In call-only mode, notify parent to close the widget
            notifyParent("widget:close", {});
          }}
          onStartCall={callSession.startCall}
          onEndCall={callSession.endCall}
          onToggleMute={callSession.toggleMute}
          status={callSession.status}
          isMuted={callSession.isMuted}
          duration={callSession.duration}
          transcript={callSession.transcript}
          audioData={callSession.audioData}
          error={callSession.error}
          connectionQuality={callSession.connectionQuality}
          isDark={isDark}
          primaryColor={config.primaryColor}
          callConfig={config.callConfig}
          agentName={config.title}
          agentAvatarUrl={config.avatarUrl}
          inline={true}
        />
      </div>
    );
  }

  // Show pre-chat form if needed
  if (showPreChatForm && !preChatSubmitted) {
    return (
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden",
          isDark ? "bg-zinc-900 text-white" : "bg-white text-zinc-900",
          className
        )}
        style={{
          borderRadius: `${borderRadius}px`,
          ...style,
        }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between p-4"
          style={{
            backgroundColor: config.primaryColor,
            borderTopLeftRadius: `${borderRadius}px`,
            borderTopRightRadius: `${borderRadius}px`,
          }}
        >
          <div className="flex items-center gap-3">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="Logo" className="h-10 w-10 rounded-full object-cover" />
            ) : config.avatarUrl ? (
              <img src={config.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : null}
            <div>
              <h1 className="font-semibold text-white">{config.title || "Chat Support"}</h1>
              {config.subtitle && <p className="text-sm text-white/80">{config.subtitle}</p>}
            </div>
          </div>
          <button
            onClick={handleMinimize}
            className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Pre-chat form */}
        <div className={cn("flex-1 flex items-center justify-center p-6", isDark ? "bg-zinc-900" : "bg-gray-50")}>
          <form onSubmit={handlePreChatSubmit} className="w-full max-w-sm space-y-4">
            <div className="text-center mb-6">
              <h2 className={cn("text-lg font-semibold mb-1", isDark ? "text-white" : "text-gray-900")}>
                Before we chat
              </h2>
              <p className={cn("text-sm", isDark ? "text-zinc-400" : "text-gray-500")}>
                Please provide your information to get started
              </p>
            </div>

            {config.requireName && (
              <div>
                <label className={cn("block text-sm font-medium mb-1.5", isDark ? "text-zinc-300" : "text-gray-700")}>
                  Name
                </label>
                <input
                  type="text"
                  value={preChatName}
                  onChange={(e) => setPreChatName(e.target.value)}
                  required
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border outline-none transition-colors",
                    isDark
                      ? "bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-zinc-500"
                      : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-gray-400"
                  )}
                  placeholder="Your name"
                />
              </div>
            )}

            {config.requireEmail && (
              <div>
                <label className={cn("block text-sm font-medium mb-1.5", isDark ? "text-zinc-300" : "text-gray-700")}>
                  Email
                </label>
                <input
                  type="email"
                  value={preChatEmail}
                  onChange={(e) => setPreChatEmail(e.target.value)}
                  required
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border outline-none transition-colors",
                    isDark
                      ? "bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-zinc-500"
                      : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-gray-400"
                  )}
                  placeholder="your@email.com"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: config.primaryColor }}
            >
              Start Chat
            </button>
          </form>
        </div>

        {/* Branding */}
        {config.showBranding && (
          <div
            className={cn("py-2 text-center text-xs", isDark ? "text-zinc-500" : "text-gray-400")}
            style={{
              borderBottomLeftRadius: `${borderRadius}px`,
              borderBottomRightRadius: `${borderRadius}px`,
            }}
          >
            Powered by{" "}
            <a href="https://buzzi.ai" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: config.primaryColor }}>
              Buzzi
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden",
        isDark ? "bg-zinc-900 text-white" : "bg-white text-zinc-900",
        className
      )}
      style={{
        ["--primary-color" as string]: config.primaryColor,
        ["--accent-color" as string]: accentColor,
        borderRadius: `${borderRadius}px`,
        ...style,
      }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between p-4"
        style={{
          backgroundColor: config.primaryColor,
          borderTopLeftRadius: `${borderRadius}px`,
          borderTopRightRadius: `${borderRadius}px`,
        }}
      >
        <div className="flex items-center gap-3">
          {/* Logo or Avatar */}
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt="Logo"
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : config.avatarUrl ? (
            <img
              src={config.avatarUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : null}
          <div>
            <h1 className="font-semibold text-white">
              {config.title || "Chat Support"}
            </h1>
            {config.subtitle && (
              <p className="text-sm text-white/80">{config.subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Call History button - show when calls are enabled and session exists */}
          {config.enableCall && session?.endUserId && (
            <button
              onClick={() => setShowCallHistory(true)}
              className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Call history"
              title="View call history"
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
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                <path d="M14.05 2a9 9 0 0 1 8 7.94" />
                <path d="M14.05 6A5 5 0 0 1 18 10" />
              </svg>
            </button>
          )}
          {/* New Chat button - show when there are user messages */}
          {messages.some(m => m.role === "user") && (
            <button
              onClick={handleNewChat}
              className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Start new conversation"
              title="Start new conversation"
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
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <line x1="12" y1="8" x2="12" y2="14" />
                <line x1="9" y1="11" x2="15" y2="11" />
              </svg>
            </button>
          )}
          <button
            onClick={handleMinimize}
            className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close"
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
        </div>
      </header>

      {/* Multi-agent horizontal agents list */}
      {config.isMultiAgent && config.showAgentListOnTop !== false && config.agentsList && config.agentsList.length > 0 && (() => {
        const listingType = config.agentListingType || "detailed";
        const showAvatar = listingType === "standard" || listingType === "detailed";
        const showDesignation = listingType === "compact" || listingType === "detailed";

        return (
          <>
            {/* Animation styles for agent list */}
            <style>{`
              @keyframes widget-opacity-pulse {
                0%, 100% {
                  opacity: 1;
                }
                50% {
                  opacity: 0.6;
                }
              }
              @keyframes widget-agent-enter {
                0% {
                  opacity: 0;
                  transform: translateX(-16px) scale(0.85);
                }
                60% {
                  opacity: 1;
                  transform: translateX(2px) scale(1.02);
                }
                100% {
                  opacity: 1;
                  transform: translateX(0) scale(1);
                }
              }
              @keyframes widget-agent-enter-inactive {
                0% {
                  opacity: 0;
                  transform: translateX(-16px) scale(0.85);
                }
                60% {
                  opacity: 0.6;
                  transform: translateX(2px) scale(1.02);
                }
                100% {
                  opacity: 0.6;
                  transform: translateX(0) scale(1);
                }
              }
            `}</style>
            <div
              ref={agentsListRef}
              className={cn(
                "flex gap-px overflow-x-auto",
                isDark ? "bg-zinc-800" : "bg-gray-200",
                // Hide scrollbar
                "scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              )}
            >
              {/* Only show agents that have been revealed (starting with supervisor, then as transfers happen) */}
              {config.agentsList.filter((agent) => visibleAgents.has(agent.id)).map((agent) => {
                const isActive = activeAgentId === agent.id;
                const hasAnimated = animatedAgentsRef.current.has(agent.id);

                // Build animation style based on state
                const getAnimationStyle = () => {
                  if (!hasAnimated) {
                    // First time appearing - play entrance animation
                    return isActive
                      ? "widget-agent-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, widget-opacity-pulse 2s ease-in-out 0.4s infinite"
                      : "widget-agent-enter-inactive 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards";
                  }
                  // Already animated - only pulse if active
                  return isActive ? "widget-opacity-pulse 2s ease-in-out infinite" : "none";
                };

                return (
                  <div
                    key={agent.id}
                    data-agent-id={agent.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1 shrink-0 transition-opacity duration-300",
                      !showAvatar && "py-0.5", // Smaller padding when no avatar
                      isActive && "ring-1 ring-inset"
                    )}
                    style={{
                      animation: getAnimationStyle(),
                      opacity: hasAnimated && !isActive ? 0.6 : undefined,
                      backgroundColor: isActive ? (isDark ? "rgba(39,39,42,1)" : "white") : undefined,
                      borderRadius: isActive ? "3px" : undefined,
                      ["--tw-ring-color" as string]: isActive ? config.accentColor : undefined,
                    }}
                    onAnimationEnd={(e) => {
                      // Mark as animated after entrance animation completes
                      if (e.animationName === "widget-agent-enter" || e.animationName === "widget-agent-enter-inactive") {
                        animatedAgentsRef.current.add(agent.id);
                      }
                    }}
                  >
                    {/* Avatar - only show for standard and detailed */}
                    {showAvatar && (
                      <div className="shrink-0">
                        {agent.avatarUrl ? (
                          <img
                            src={agent.avatarUrl}
                            alt={agent.name}
                            className={cn(
                              "h-6 w-6 rounded-full object-cover",
                              isActive && "ring-2 ring-green-500"
                            )}
                          />
                        ) : (
                          <div
                            className={cn(
                              "h-6 w-6 rounded-full flex items-center justify-center text-white font-medium text-[10px]",
                              isActive && "ring-2 ring-green-500"
                            )}
                            style={{ backgroundColor: config.accentColor || config.primaryColor }}
                          >
                            {agent.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Name and designation */}
                    <div className={cn("min-w-0", !showAvatar && "text-center")}>
                      <p
                        className={cn(
                          "text-xs font-medium truncate max-w-[80px]",
                          isDark ? "text-zinc-300" : "text-gray-700"
                        )}
                      >
                        {agent.name}
                      </p>
                      {/* Designation - only show for compact and detailed */}
                      {showDesignation && agent.designation && (
                        <p
                          className={cn(
                            "text-[10px] truncate max-w-[80px]",
                            isDark ? "text-zinc-500" : "text-gray-500"
                          )}
                        >
                          {agent.designation}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Render human agent if joined and agent list is enabled */}
              {isWithHuman && currentHumanAgent && (
                <div
                  key={`human-${currentHumanAgent.id}`}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1 shrink-0 transition-opacity duration-300 ring-1 ring-inset",
                    !showAvatar && "py-0.5"
                  )}
                  style={{
                    animation: "widget-agent-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                    backgroundColor: isDark ? "rgba(39,39,42,1)" : "white",
                    borderRadius: "3px",
                    ["--tw-ring-color" as string]: "#22c55e", // Green ring for human
                  }}
                >
                  {showAvatar && (
                    <div className="shrink-0">
                      {currentHumanAgent.avatarUrl ? (
                        <img
                          src={currentHumanAgent.avatarUrl}
                          alt={currentHumanAgent.name}
                          className="h-6 w-6 rounded-full object-cover ring-2 ring-green-500"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full flex items-center justify-center bg-green-500 text-white font-medium text-[10px] ring-2 ring-green-500">
                          {currentHumanAgent.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div className={cn("min-w-0", !showAvatar && "text-center")}>
                    <p
                      className={cn(
                        "text-xs font-medium truncate max-w-[80px]",
                        isDark ? "text-zinc-300" : "text-gray-700"
                      )}
                    >
                      {currentHumanAgent.name}
                    </p>
                    {showDesignation && (
                      <p
                        className={cn(
                          "text-[10px] truncate max-w-[80px]",
                          isDark ? "text-zinc-500" : "text-gray-500"
                        )}
                      >
                        Support Agent
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className={cn(
          "flex-1 overflow-y-auto p-4 space-y-4",
          isDark ? "bg-zinc-900" : "bg-gray-50"
        )}
      >
        {messages.map((message) => {
          // Render transfer notifications with TransferBubble component
          if (message.isTransfer) {
            // Get previous agent info - fallback to supervisor or first agent
            const previousAgent: AgentInfo = {
              id: message.previousAgentId || "supervisor",
              name: message.previousAgentName || "Assistant",
              avatarUrl: message.previousAgentAvatarUrl,
            };

            // Get new agent info
            const newAgent: AgentInfo = {
              id: message.targetAgentId || "agent",
              name: message.targetAgentName || "Agent",
              designation: message.targetAgentDesignation,
              avatarUrl: message.targetAgentAvatarUrl,
            };

            return (
              <TransferBubble
                key={message.id}
                previousAgent={previousAgent}
                newAgent={newAgent}
                isDark={isDark}
                accentColor={accentColor}
              />
            );
          }

          // Render human waiting bubble
          if (message.isHumanWaiting) {
            const initiatingAgent = message.previousAgentId
              ? config?.agentsList?.find((a) => a.id === message.previousAgentId)
              : undefined;

            return (
              <HumanWaitingBubble
                key={message.id}
                initiatingAgent={initiatingAgent}
                isDark={isDark}
                accentColor={accentColor}
                onCancelEscalation={handleCancelEscalation}
              />
            );
          }

          // Render auth required bubble with login form
          if (message.isAuthRequired && authState.isRequired && session) {
            return (
              <AuthFormBubble
                key={message.id}
                authState={authState}
                sessionId={session.sessionId}
                primaryColor={config?.primaryColor}
                onAuthSuccess={() => {
                  // Clear auth state on success
                  setAuthState({
                    isRequired: false,
                    isAuthenticated: true,
                  });
                  // Remove auth form message
                  setMessages((prev) => prev.filter((m) => !m.isAuthRequired));

                  // Auto-resend the pending message that triggered auth
                  if (pendingAuthMessage) {
                    const messageToSend = pendingAuthMessage;
                    setPendingAuthMessage(null);
                    // Small delay to ensure auth state is cleared first
                    setTimeout(() => {
                      sendMessageRef.current(messageToSend);
                    }, 100);
                  }
                }}
                onAuthError={(error) => {
                  setAuthState((prev) => ({
                    ...prev,
                    error,
                    isSubmitting: false,
                  }));
                }}
                onNextStep={(step) => {
                  // Move to next auth step
                  setAuthState((prev) => ({
                    ...prev,
                    currentStep: {
                      stepId: step.stepId,
                      stepName: step.stepName,
                      fields: step.fields,
                      aiPrompt: step.aiPrompt,
                    },
                    error: undefined,
                    isSubmitting: false,
                  }));
                  // Update the auth message with new step prompt
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.isAuthRequired
                        ? {
                            ...m,
                            authStepId: step.stepId,
                            authFields: step.fields,
                            authPrompt: step.aiPrompt,
                          }
                        : m
                    )
                  );
                }}
              />
            );
          }

          // Render human joined bubble
          if (message.isHumanJoined) {
            const previousAgent = message.previousAgentId
              ? config?.agentsList?.find((a) => a.id === message.previousAgentId)
              : config?.agentsList?.[0];

            return (
              <HumanJoinedBubble
                key={message.id}
                humanAgent={{
                  id: message.humanAgentId || "agent",
                  name: message.humanAgentName || "Support Agent",
                  avatarUrl: message.humanAgentAvatarUrl,
                }}
                previousAgent={previousAgent ? { name: previousAgent.name, avatarUrl: previousAgent.avatarUrl } : undefined}
                isDark={isDark}
                accentColor={accentColor}
              />
            );
          }

          // Render human exited bubble
          if (message.isHumanExited) {
            return (
              <HumanExitedBubble
                key={message.id}
                humanAgent={{
                  id: message.humanAgentId || "agent",
                  name: message.humanAgentName || "Support Agent",
                  avatarUrl: message.humanAgentAvatarUrl,
                }}
                isDark={isDark}
                accentColor={accentColor}
              />
            );
          }

          // Render other notification messages (non-transfer)
          if (message.isNotification) {
            return (
              <div key={message.id} className="flex justify-center my-3">
                <div
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm",
                    isDark
                      ? "bg-zinc-800/80 text-zinc-300"
                      : "bg-gray-100 text-gray-600"
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
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>{message.content}</span>
                </div>
              </div>
            );
          }

          const isUser = message.role === "user";
          // Show agent info for multi-agent AI messages OR human agent messages
          const showAgentInfo =
            !isUser && (
              (config.isMultiAgent && message.agentName) ||
              (message.isFromHumanAgent && (message.agentName || message.humanAgentName))
            );
          // Get display values for human agent messages
          const displayAgentName = message.agentName || message.humanAgentName || "Support Agent";
          const displayAgentAvatarUrl = message.agentAvatarUrl || message.humanAgentAvatarUrl;
          const displayAgentColor = message.isFromHumanAgent ? "#22c55e" : message.agentColor; // Green for human

          // Skip rendering the streaming placeholder when ThinkingBubble is shown
          const isStreamingPlaceholder =
            message.id === streamingMessageId &&
            message.status === "sending" &&
            !message.content;
          if (isStreamingPlaceholder && thinkingState) {
            return null;
          }

          return (
            <div
              key={message.id}
              className={cn("flex", isUser ? "justify-end" : "justify-start")}
            >
              <div className={cn("max-w-[85%]", !isUser && "flex gap-2")}>
                {/* Agent avatar for assistant messages */}
                {!isUser && showAgentInfo && (
                  <div className="shrink-0 pt-1">
                    {displayAgentAvatarUrl ? (
                      <img
                        src={displayAgentAvatarUrl}
                        alt={displayAgentName}
                        className="h-7 w-7 rounded-full object-cover"
                        style={displayAgentColor ? { boxShadow: `0 0 0 2px ${displayAgentColor}` } : undefined}
                      />
                    ) : (
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-white font-medium text-xs"
                        style={{ backgroundColor: displayAgentColor || config.primaryColor }}
                      >
                        {displayAgentName?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  {/* Agent name above bubble */}
                  {!isUser && showAgentInfo && (
                    <p
                      className={cn(
                        "text-xs mb-1 ml-1",
                        isDark ? "text-zinc-400" : "text-gray-500"
                      )}
                    >
                      {displayAgentName}
                    </p>
                  )}
                  {/* Voice message bubble */}
                  {message.type === "audio" && message.audioUrl ? (
                    <VoiceMessageBubble
                      audioUrl={message.audioUrl}
                      transcript={message.transcript || message.content || ""}
                      duration={message.duration || 0}
                      isDark={isDark}
                      primaryColor={config.primaryColor}
                      bubbleColor={isUser ? (config.userBubbleColor || config.primaryColor) : undefined}
                      isUser={isUser}
                    />
                  ) : message.type === "audio" && !message.audioUrl ? (
                    /* Voice message still uploading */
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 min-w-[200px]",
                        isUser ? "rounded-br-sm" : "rounded-bl-sm",
                        message.status === "sending" && "opacity-70"
                      )}
                      style={{
                        backgroundColor: isUser
                          ? (config.userBubbleColor || config.primaryColor)
                          : (isDark ? "#374151" : "#f3f4f6"),
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                          style={{
                            borderColor: isUser
                              ? "rgba(255,255,255,0.5) transparent transparent transparent"
                              : `${config.primaryColor} transparent transparent transparent`,
                          }}
                        />
                        <span
                          className="text-sm"
                          style={{
                            color: isUser
                              ? getContrastTextColor(config.userBubbleColor || config.primaryColor)
                              : (isDark ? "#e5e7eb" : "#374151"),
                          }}
                        >
                          Processing voice...
                        </span>
                      </div>
                    </div>
                  ) : (
                  /* Regular text message bubble */
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5",
                      isUser
                        ? "rounded-br-sm"
                        : cn(
                            "rounded-bl-sm",
                            // Only use default bg when no custom color is set
                            !config.overrideAgentColor && !message.agentColor && (isDark ? "bg-zinc-800" : "bg-white shadow-sm")
                          ),
                      message.status === "sending" && "opacity-70"
                    )}
                    style={(() => {
                      if (isUser) {
                        const userBg = config.userBubbleColor || config.primaryColor;
                        return {
                          backgroundColor: userBg,
                          color: getContrastTextColor(userBg),
                        };
                      }
                      // Agent messages
                      if (config.overrideAgentColor && config.agentBubbleColor) {
                        return {
                          backgroundColor: config.agentBubbleColor,
                          color: getContrastTextColor(config.agentBubbleColor),
                        };
                      }
                      if (message.agentColor) {
                        return {
                          backgroundColor: message.agentColor,
                          color: getContrastTextColor(message.agentColor),
                        };
                      }
                      return undefined;
                    })()}
                  >
                    {message.content ? (
                      config.enableMarkdown !== false ? (
                        (() => {
                          // Determine if we need light text (prose-invert) based on background
                          const hasDarkBg = (() => {
                            if (isUser) {
                              const bg = config.userBubbleColor || config.primaryColor;
                              return getContrastTextColor(bg) === "#FFFFFF";
                            }
                            if (config.overrideAgentColor && config.agentBubbleColor) {
                              return getContrastTextColor(config.agentBubbleColor) === "#FFFFFF";
                            }
                            if (message.agentColor) {
                              return getContrastTextColor(message.agentColor) === "#FFFFFF";
                            }
                            return isDark;
                          })();
                          return (
                            <div
                              className={cn(
                                "prose prose-sm max-w-none",
                                hasDarkBg && "prose-invert",
                                "[&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_pre]:my-1 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs",
                                hasDarkBg
                                  ? "[&_code]:bg-white/20"
                                  : "[&_code]:bg-black/10"
                              )}
                            >
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          );
                        })()
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )
                    ) : message.status === "sending" && !thinkingState ? (
                      <span className="inline-flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
                      </span>
                    ) : null}
                  </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking indicator using ThinkingBubble component */}
        {thinkingState && (
          <ThinkingBubble
            agent={
              activeAgentId
                ? getAgentInfo(activeAgentId) || undefined
                : undefined
            }
            thinkingText={thinkingState?.text}
            toolCalls={
              config.showThinking && thinkingState?.toolCalls
                ? (thinkingState.toolCalls as ToolCallState[])
                : undefined
            }
            isDark={isDark}
            accentColor={accentColor}
          />
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
            "relative flex items-end gap-2 rounded-2xl px-4 py-2 transition-all",
            isDark ? "bg-zinc-800" : "bg-gray-100",
            isFocused && "ring-2"
          )}
          style={isFocused ? { ["--tw-ring-color" as string]: config.primaryColor } : undefined}
        >
          {/* PTT help message - shows when user clicks voice button without holding */}
          {showPttHelp && (
            <div
              className={cn(
                "absolute right-12 bottom-1/2 translate-y-1/2 text-xs px-3 py-1.5 rounded-lg whitespace-nowrap z-10 shadow-sm",
                isDark ? "bg-zinc-700 text-zinc-200" : "bg-white text-gray-600 border border-gray-200"
              )}
            >
              Hold and speak
            </div>
          )}
          {/* Recording waveform - replaces textarea when recording */}
          {isRecording || isVoiceStarting ? (
            <>
              {/* Audio waveform visualization */}
              <div className="flex-1 flex items-center gap-2 py-1">
                <div className="flex items-center justify-center gap-0.5 h-6 flex-1">
                  {(audioData.length > 0 ? audioData.slice(0, 24) : Array(24).fill(0)).map((value, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.max(4, (value / 255) * 20)}px`,
                        backgroundColor: config.primaryColor,
                      }}
                    />
                  ))}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium shrink-0",
                    isDark ? "text-zinc-400" : "text-gray-500"
                  )}
                >
                  {isVoiceStarting ? "Starting..." : `${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60).toString().padStart(2, "0")}`}
                </span>
              </div>
              {/* Cancel button */}
              <button
                type="button"
                onClick={cancelRecording}
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
          ) : isSendingVoice ? (
            <>
              {/* Sending voice message state */}
              <div className="flex-1 flex items-center gap-2 py-1">
                <div
                  className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                  style={{ borderColor: `${config.primaryColor} transparent transparent transparent` }}
                />
                <span
                  className={cn(
                    "text-sm",
                    isDark ? "text-zinc-400" : "text-gray-500"
                  )}
                >
                  Sending voice message...
                </span>
              </div>
            </>
          ) : (
            <>
              {/* Text input - auto-expands up to 3 lines */}
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onPaste={() => {
                  // Trigger resize after paste content is applied
                  setTimeout(adjustTextareaHeight, 0);
                }}
                placeholder={config.placeholderText || "Type a message..."}
                rows={1}
                className={cn(
                  "flex-1 resize-none bg-transparent overflow-y-auto",
                  isDark ? "placeholder:text-zinc-500" : "placeholder:text-gray-400"
                )}
                style={{ outline: "none", border: "none", boxShadow: "none", lineHeight: "20px", padding: "8px 0" }}
              />
              {/* Processing spinner / Voice button / Send button */}
              {isSending ? (
                <div className="rounded-full p-2 shrink-0">
                  <div
                    className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                    style={{ borderColor: `${config.primaryColor} transparent transparent transparent` }}
                  />
                </div>
              ) : inputValue.trim() ? (
                <button
                  type="submit"
                  className="rounded-full p-2 transition-colors text-white shrink-0"
                  style={{ backgroundColor: config.primaryColor }}
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
              ) : (
                <>
                  {/* Call button */}
                  {config.enableCall && (
                    <button
                      type="button"
                      onClick={() => setIsCallDialogOpen(true)}
                      className={cn(
                        "rounded-full p-2 transition-colors shrink-0",
                        isDark
                          ? "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700"
                          : "text-gray-500 hover:text-gray-600 hover:bg-gray-200"
                      )}
                      aria-label="Start voice call"
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
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </button>
                  )}
                  {/* Voice recording button */}
                  {config.enableVoice && isVoiceSupported && (
                    <button
                      type="button"
                      onMouseDown={handlePttClick}
                      onMouseUp={handleVoiceRecordingStop}
                      onMouseLeave={handleVoiceRecordingStop}
                      onTouchStart={handlePttClick}
                      onTouchEnd={handleVoiceRecordingStop}
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
                  )}
                </>
              )}
            </>
          )}
        </div>
      </form>

      {/* Branding */}
      {config.showBranding && (
        <div
          className={cn(
            "py-2 text-center text-xs",
            isDark ? "text-zinc-500" : "text-gray-400"
          )}
          style={{
            borderBottomLeftRadius: `${borderRadius}px`,
            borderBottomRightRadius: `${borderRadius}px`,
          }}
        >
          Powered by{" "}
          <a
            href="https://buzzi.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: accentColor }}
          >
            Buzzi
          </a>
        </div>
      )}

      {/* Call Dialog */}
      {config.enableCall && (
        <CallDialog
          isOpen={isCallDialogOpen}
          onClose={() => {
            if (callSession.status === "idle" || callSession.status === "ended" || callSession.status === "error") {
              setIsCallDialogOpen(false);
            }
          }}
          onStartCall={callSession.startCall}
          onEndCall={callSession.endCall}
          onToggleMute={callSession.toggleMute}
          status={callSession.status}
          isMuted={callSession.isMuted}
          duration={callSession.duration}
          transcript={callSession.transcript}
          audioData={callSession.audioData}
          error={callSession.error}
          connectionQuality={callSession.connectionQuality}
          isDark={isDark}
          primaryColor={config.primaryColor}
          callConfig={config.callConfig}
          agentName={config.title}
          agentAvatarUrl={config.avatarUrl}
        />
      )}

      {/* Call History Modal */}
      {showCallHistory && config.enableCall && session?.endUserId && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ borderRadius: `${borderRadius}px` }}>
          <CallHistory
            chatbotId={config.agentId}
            endUserId={session.endUserId}
            primaryColor={config.primaryColor}
            onClose={() => setShowCallHistory(false)}
            className="h-full"
          />
        </div>
      )}
    </div>
  );
}

export default ChatWindow;
