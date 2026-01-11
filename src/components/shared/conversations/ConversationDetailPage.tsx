"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  MoreVertical,
  CheckCircle,
  UserPlus,
  Bot,
  XCircle,
  Clock,
  MessageSquare,
  User,
  AlertCircle,
  Star,
  StarOff,
  X,
  Mail,
  Phone,
  Globe,
  Calendar,
  ExternalLink,
  Check,
  CheckCheck,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

import {
  Button,
  Dropdown,
  type DropdownMenuItemData,
  Badge,
  Spinner,
  Textarea,
  addToast,
  Avatar,
  ScrollShadow,
  Divider,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  getSupabaseBrowserClient,
  isRealtimeConfigured,
} from "@/lib/supabase/realtime";

// ============================================================================
// Types
// ============================================================================

export interface EndUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  channel: string;
  metadata?: Record<string, unknown> | null;
  totalConversations?: number;
  lastSeenAt?: string | null;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface AssignedUser {
  id: string;
  name: string | null;
  email: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "human_agent" | "system";
  type: string;
  content: string;
  attachments?: Array<{ type: string; url: string; name: string }>;
  isRead?: boolean;
  readAt?: string | null;
  toolCalls?: unknown[];
  sourceChunkIds?: string[];
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  user?: { id: string; name: string | null; email: string } | null;
  tokenCount?: number | null;
  processingTimeMs?: number | null;
}

export interface Conversation {
  id: string;
  status: string;
  subject: string | null;
  channel: string;
  messageCount: number;
  userMessageCount?: number;
  assistantMessageCount?: number;
  sentiment?: number | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  pageUrl?: string | null;
  referrer?: string | null;
  isStarred?: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  resolvedAt: string | null;
  resolutionType?: string | null;
  endUser: EndUser | null;
  agent: Agent | null;
  assignedUser?: AssignedUser | null;
}

export interface PreviousConversation {
  id: string;
  subject: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  satisfactionRating?: number | null;
}

// ============================================================================
// Status Configuration
// ============================================================================

type StatusConfig = {
  label: string;
  variant: "default" | "success" | "warning" | "danger" | "info";
  icon: React.ComponentType<{ className?: string }>;
};

const defaultStatus: StatusConfig = {
  label: "Active",
  variant: "info",
  icon: MessageSquare,
};

const statusConfig: Record<string, StatusConfig> = {
  active: { label: "Active", variant: "info", icon: MessageSquare },
  waiting_human: { label: "Waiting", variant: "warning", icon: Clock },
  with_human: { label: "With Human", variant: "info", icon: Bot },
  resolved: { label: "Resolved", variant: "success", icon: CheckCircle },
  abandoned: { label: "Abandoned", variant: "danger", icon: XCircle },
};

function getStatusConfig(status: string): StatusConfig {
  return statusConfig[status] ?? defaultStatus;
}

// ============================================================================
// Message Icon Helper
// ============================================================================

function getMessageIcon(role: Message["role"]) {
  switch (role) {
    case "user":
      return <User size={16} />;
    case "assistant":
      return <Bot size={16} />;
    case "human_agent":
      return <User size={16} />;
    case "system":
      return <AlertCircle size={16} />;
    default:
      return null;
  }
}

// ============================================================================
// Component Props
// ============================================================================

export interface ConversationDetailPageProps {
  /** Conversation ID */
  conversationId: string;
  /** API base path for conversation operations (e.g., "/api/company/conversations" or "/api/support-agent/conversations") */
  apiBasePath: string;
  /** Back navigation URL */
  backUrl: string;
  /** Whether to show advanced features (canned responses, AI summary, etc.) */
  showAdvancedFeatures?: boolean;
  /** Whether to show the sidebar by default */
  defaultShowSidebar?: boolean;
  /** Whether to show previous conversations in sidebar */
  showPreviousConversations?: boolean;
  /** Callback when navigating to previous conversation */
  onPreviousConversationClick?: (conversationId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ConversationDetailPage({
  conversationId,
  apiBasePath,
  backUrl,
  showAdvancedFeatures = false,
  defaultShowSidebar = true,
  showPreviousConversations = false,
  onPreviousConversationClick,
}: ConversationDetailPageProps) {
  const router = useRouter();

  // State
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [previousConversations, setPreviousConversations] = useState<PreviousConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(defaultShowSidebar);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [closingMessage, setClosingMessage] = useState("");
  const [takingOver, setTakingOver] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchConversation = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${apiBasePath}/${conversationId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch conversation");
      }
      const result = await response.json();

      // Handle different API response formats
      if (result.conversation) {
        setConversation(result.conversation);
      } else {
        setConversation(result);
      }

      if (result.messages) {
        setMessages(result.messages);
      }

      if (result.previousConversations) {
        setPreviousConversations(result.previousConversations);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, conversationId]);

  // Fetch messages separately if needed (for company-admin API)
  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(`${apiBasePath}/${conversationId}/messages`);
      if (response.ok) {
        const result = await response.json();
        if (result.messages) {
          setMessages(result.messages);
        }
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  }, [apiBasePath, conversationId]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  // Fetch messages separately for company-admin API format
  useEffect(() => {
    if (conversation && messages.length === 0) {
      fetchMessages();
    }
  }, [conversation, messages.length, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription for new messages via broadcast
  useEffect(() => {
    if (!conversationId || !isRealtimeConfigured()) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on("broadcast", { event: "new_message" }, (payload) => {
        const msg = payload.payload as {
          id: string;
          conversationId: string;
          role: string;
          content: string;
          createdAt: string;
          userId?: string;
          userName?: string;
        };

        if (msg?.id) {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === msg.id)) return prev;

            const newMessage: Message = {
              id: msg.id,
              role: (msg.role as Message["role"]) || "user",
              type: "text",
              content: msg.content || "",
              attachments: [],
              isRead: false,
              readAt: null,
              toolCalls: [],
              sourceChunkIds: [],
              metadata: null,
              createdAt: msg.createdAt || new Date().toISOString(),
              user: msg.userName ? { id: msg.userId || "", name: msg.userName, email: "" } : null,
            };

            return [...prev, newMessage];
          });
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[Realtime] Subscribed to conversation ${conversationId}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // ============================================================================
  // Actions
  // ============================================================================

  const sendMessage = async () => {
    if (!messageInput.trim() || sending) return;

    setSending(true);
    try {
      const response = await fetch(`${apiBasePath}/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageInput }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const result = await response.json();

      // Add message to local state
      const newMessage: Message = {
        id: result.message?.id || `temp-${Date.now()}`,
        role: "human_agent",
        type: "text",
        content: messageInput,
        attachments: [],
        isRead: false,
        readAt: null,
        toolCalls: [],
        sourceChunkIds: [],
        metadata: null,
        createdAt: result.message?.createdAt || new Date().toISOString(),
        user: null,
      };

      setMessages((prev) => [...prev, newMessage]);
      setMessageInput("");
      inputRef.current?.focus();

      // Update conversation status if needed
      if (conversation?.status !== "with_human") {
        setConversation((prev) =>
          prev ? { ...prev, status: "with_human" } : null
        );
      }
    } catch (err) {
      addToast({
        title: "Failed to send message",
        color: "danger",
      });
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleTakeOver = async () => {
    setTakingOver(true);
    try {
      // Try support-agent API format first
      let response = await fetch(`${apiBasePath}/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "takeOver" }),
      });

      // If that fails, try company-admin API format
      if (!response.ok) {
        response = await fetch(`${apiBasePath}/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "with_human" }),
        });
      }

      if (!response.ok) {
        throw new Error("Failed to take over conversation");
      }

      setConversation((prev) =>
        prev ? { ...prev, status: "with_human" } : null
      );

      addToast({
        title: "You are now handling this conversation",
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Failed to take over conversation",
        color: "danger",
      });
      console.error("Failed to take over:", err);
    } finally {
      setTakingOver(false);
    }
  };

  const handleReturnToAI = async () => {
    setIsUpdating(true);
    try {
      // Try support-agent API format first
      let response = await fetch(`${apiBasePath}/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "returnToAi" }),
      });

      // If that fails, try company-admin API format
      if (!response.ok) {
        response = await fetch(`${apiBasePath}/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active", assignedUserId: null }),
        });
      }

      if (!response.ok) {
        throw new Error("Failed to return to AI");
      }

      setConversation((prev) =>
        prev ? { ...prev, status: "active", assignedUser: null } : null
      );

      addToast({
        title: "Conversation returned to AI",
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Failed to return to AI",
        color: "danger",
      });
      console.error("Failed to return to AI:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResolve = async () => {
    setIsUpdating(true);
    try {
      // Try support-agent API format first
      let response = await fetch(`${apiBasePath}/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          data: {
            resolutionType: "human",
            closingMessage: closingMessage.trim() || undefined,
          },
        }),
      });

      // If that fails, try company-admin API format
      if (!response.ok) {
        response = await fetch(`${apiBasePath}/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "resolved",
            resolutionType: "human",
          }),
        });
      }

      if (!response.ok) {
        throw new Error("Failed to resolve conversation");
      }

      setShowResolveModal(false);
      addToast({
        title: "Conversation resolved",
        color: "success",
      });

      router.push(backUrl);
    } catch (err) {
      addToast({
        title: "Failed to resolve conversation",
        color: "danger",
      });
      console.error("Failed to resolve:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleStar = async () => {
    if (!conversation) return;

    try {
      await fetch(`${apiBasePath}/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: conversation.isStarred ? "unstar" : "star",
        }),
      });

      setConversation((prev) =>
        prev ? { ...prev, isStarred: !prev.isStarred } : null
      );
    } catch (err) {
      console.error("Failed to toggle star:", err);
    }
  };

  // ============================================================================
  // Dropdown Actions
  // ============================================================================

  const dropdownItems: DropdownMenuItemData[] = [
    {
      key: "take_over",
      label: "Take over conversation",
      icon: UserPlus,
    },
    {
      key: "return_to_ai",
      label: "Return to AI",
      icon: Bot,
    },
    {
      key: "resolve",
      label: "Mark as resolved",
      icon: CheckCircle,
    },
  ];

  const handleDropdownAction = (key: React.Key) => {
    switch (key) {
      case "take_over":
        handleTakeOver();
        break;
      case "return_to_ai":
        handleReturnToAI();
        break;
      case "resolve":
        setShowResolveModal(true);
        break;
    }
  };

  // ============================================================================
  // Keyboard Handler
  // ============================================================================

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ============================================================================
  // Loading / Error States
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground font-medium">
          {error || "Conversation not found"}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onPress={() => router.push(backUrl)}
        >
          Back
        </Button>
      </div>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  const status = getStatusConfig(conversation.status);
  const StatusIcon = status.icon;
  const isResolved =
    conversation.status === "resolved" || conversation.status === "abandoned";

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-divider bg-background">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.push(backUrl)}
            >
              <ArrowLeft size={20} />
            </Button>

            <Avatar
              name={conversation.endUser?.name ?? "Anonymous"}
              src={conversation.endUser?.avatarUrl ?? undefined}
              size="md"
            />

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">
                  {conversation.endUser?.name ||
                    conversation.endUser?.email ||
                    "Anonymous Customer"}
                </h2>
                <Badge variant={status.variant}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {conversation.agent?.name ?? "AI Agent"} ·{" "}
                {conversation.messageCount} messages · {conversation.channel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showAdvancedFeatures && (
              <Button variant="ghost" size="sm" onPress={toggleStar}>
                {conversation.isStarred ? (
                  <Star size={20} className="fill-warning text-warning" />
                ) : (
                  <StarOff size={20} />
                )}
              </Button>
            )}

            {!isResolved && (
              <>
                <Button
                  color="success"
                  variant="outline"
                  size="sm"
                  onPress={() => setShowResolveModal(true)}
                  isLoading={isUpdating}
                  leftIcon={CheckCircle}
                >
                  Resolve
                </Button>

                <Dropdown
                  trigger={
                    <Button variant="outline" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  }
                  items={dropdownItems}
                  onAction={handleDropdownAction}
                />
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              onPress={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? "Hide" : "Show"} Details
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollShadow className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" && "flex-row-reverse",
                message.role === "system" && "justify-center"
              )}
            >
              {message.role === "system" ? (
                <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {message.content}
                </div>
              ) : (
                <>
                  {message.role !== "user" && (
                    <Avatar
                      name={
                        message.role === "assistant"
                          ? conversation.agent?.name ?? "AI"
                          : message.user?.name ?? "Agent"
                      }
                      src={
                        message.role === "assistant"
                          ? conversation.agent?.avatarUrl ?? undefined
                          : undefined
                      }
                      size="sm"
                      className="flex-shrink-0"
                    />
                  )}

                  <div
                    className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : message.role === "assistant"
                        ? "bg-content2 rounded-bl-sm"
                        : "bg-success/10 text-success-foreground rounded-bl-sm"
                    )}
                  >
                    {message.role !== "user" && (
                      <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                        {getMessageIcon(message.role)}
                        <span>
                          {message.role === "assistant"
                            ? conversation.agent?.name ?? "AI Assistant"
                            : message.user?.name ?? "You"}
                        </span>
                      </div>
                    )}

                    <p className="whitespace-pre-wrap break-words">
                      {message.content}
                    </p>

                    <div className="flex items-center justify-end gap-1 mt-1 text-xs opacity-60">
                      <span>
                        {format(new Date(message.createdAt), "HH:mm")}
                      </span>
                      {message.role === "human_agent" &&
                        (message.isRead ? (
                          <CheckCheck size={14} className="text-primary" />
                        ) : (
                          <Check size={14} />
                        ))}
                    </div>
                  </div>

                  {message.role === "user" && (
                    <Avatar
                      name={conversation.endUser?.name ?? "User"}
                      src={conversation.endUser?.avatarUrl ?? undefined}
                      size="sm"
                      className="flex-shrink-0"
                    />
                  )}
                </>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </ScrollShadow>

        {/* Input Area */}
        {!isResolved && (
          <div className="border-t border-divider p-4 bg-background">
            {conversation.status === "with_human" ? (
              <>
                <div className="flex gap-2 items-end max-w-3xl mx-auto">
                  <Textarea
                    ref={inputRef}
                    placeholder="Type a message as human agent..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    minRows={1}
                    className="flex-1"
                  />

                  <Button
                    color="primary"
                    size="icon"
                    onPress={sendMessage}
                    isLoading={sending}
                    disabled={!messageInput.trim()}
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-divider max-w-3xl mx-auto">
                  <Button
                    variant="secondary"
                    size="sm"
                    color="secondary"
                    onPress={handleReturnToAI}
                    isLoading={isUpdating}
                  >
                    <Bot size={16} className="mr-1" />
                    Return to AI
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    Messages you send will appear as from a human agent
                  </p>
                </div>
              </>
            ) : (
              <div className="max-w-3xl mx-auto text-center">
                <Button
                  color="primary"
                  size="lg"
                  onPress={handleTakeOver}
                  isLoading={takingOver}
                  leftIcon={UserPlus}
                >
                  Take Over Conversation
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  {conversation.status === "waiting_human"
                    ? "Customer is waiting for a human agent"
                    : "Click to handle this conversation as a human agent"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Resolved Banner */}
        {isResolved && (
          <div className="border-t border-divider p-4 bg-muted text-center">
            <p className="text-sm text-muted-foreground">
              This conversation has been {conversation.status}.
              {conversation.resolvedAt && (
                <span>
                  {" "}
                  Resolved{" "}
                  {formatDistanceToNow(new Date(conversation.resolvedAt), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Sidebar */}
      {showSidebar && (
        <div className="w-80 border-l border-divider bg-content1 overflow-y-auto hidden md:block">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Customer Info</h3>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setShowSidebar(false)}
              >
                <X size={16} />
              </Button>
            </div>

            {/* Customer Profile */}
            <div className="text-center mb-6">
              <Avatar
                name={conversation.endUser?.name ?? "Anonymous"}
                src={conversation.endUser?.avatarUrl ?? undefined}
                size="lg"
                className="mx-auto mb-3"
              />
              <h4 className="font-medium">
                {conversation.endUser?.name ?? "Anonymous"}
              </h4>
              {conversation.endUser?.email && (
                <p className="text-sm text-muted-foreground">
                  {conversation.endUser.email}
                </p>
              )}

              {/* Tags */}
              {conversation.tags && conversation.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center mt-2">
                  {conversation.tags.map((tag) => (
                    <Chip key={tag} size="sm">
                      {tag}
                    </Chip>
                  ))}
                </div>
              )}
            </div>

            <Divider className="my-4" />

            {/* Contact Info */}
            <div className="space-y-3">
              {conversation.endUser?.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={16} className="text-muted-foreground" />
                  <span>{conversation.endUser.email}</span>
                </div>
              )}
              {conversation.endUser?.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={16} className="text-muted-foreground" />
                  <span>{conversation.endUser.phone}</span>
                </div>
              )}
              {conversation.pageUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe size={16} className="text-muted-foreground" />
                  <a
                    href={conversation.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate"
                  >
                    {new URL(conversation.pageUrl).pathname}
                    <ExternalLink size={12} className="inline ml-1" />
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={16} className="text-muted-foreground" />
                <span>
                  Started{" "}
                  {formatDistanceToNow(new Date(conversation.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>

            <Divider className="my-4" />

            {/* Conversation Stats */}
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-muted-foreground">
                Conversation Stats
              </h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted rounded-lg p-2 text-center">
                  <p className="font-semibold">{conversation.messageCount}</p>
                  <p className="text-xs text-muted-foreground">Messages</p>
                </div>
                <div className="bg-muted rounded-lg p-2 text-center">
                  <p className="font-semibold">
                    {conversation.endUser?.totalConversations ?? 1}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Chats</p>
                </div>
              </div>
            </div>

            {/* Previous Conversations */}
            {showPreviousConversations && previousConversations.length > 0 && (
              <>
                <Divider className="my-4" />
                <div>
                  <h5 className="text-sm font-medium text-muted-foreground mb-2">
                    Previous Conversations
                  </h5>
                  <div className="space-y-2">
                    {previousConversations.slice(0, 5).map((prev) => (
                      <button
                        key={prev.id}
                        onClick={() =>
                          onPreviousConversationClick?.(prev.id) ??
                          router.push(`${backUrl}/${prev.id}`)
                        }
                        className="w-full text-left p-2 rounded-lg hover:bg-muted transition-colors text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">
                            {prev.subject ?? "No subject"}
                          </span>
                          <Badge
                            variant={
                              prev.status === "resolved" ? "success" : "default"
                            }
                            className="text-xs"
                          >
                            {prev.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(prev.createdAt), "MMM d, yyyy")}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      <Modal isOpen={showResolveModal} onClose={() => setShowResolveModal(false)}>
        <ModalContent>
          <ModalHeader>Resolve Conversation</ModalHeader>
          <ModalBody>
            <p className="text-sm text-muted-foreground mb-4">
              Send a closing message to the customer?
            </p>
            <Textarea
              label="Closing Message (optional)"
              placeholder="Thanks for chatting with us! If you have more questions, feel free to reach out."
              value={closingMessage}
              onChange={(e) => setClosingMessage(e.target.value)}
              minRows={3}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={() => setShowResolveModal(false)}>
              Cancel
            </Button>
            <Button
              color="success"
              onPress={handleResolve}
              isLoading={isUpdating}
            >
              Resolve
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
