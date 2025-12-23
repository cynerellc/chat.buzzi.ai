"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Star,
  StarOff,
  MoreVertical,
  Send,
  Paperclip,
  Smile,
  MessageSquare as MessageSquareIcon,
  Bot,
  User,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  X,
  ExternalLink,
  Tag,
  FileText,
  Phone,
  Mail,
  Globe,
  Calendar,
} from "lucide-react";

import {
  Card,
  Button,
  Avatar,
  Badge,
  Chip,
  Dropdown,
  Spinner,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider,
  ScrollShadow,
} from "@/components/ui";
import type { DropdownMenuItem } from "@/components/ui";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

// Types
interface EndUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  channel: string;
  metadata: Record<string, unknown> | null;
  totalConversations: number;
  lastSeenAt: string | null;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface AssignedUser {
  id: string;
  name: string | null;
  email: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "human_agent" | "system";
  type: string;
  content: string;
  attachments: Array<{ type: string; url: string; name: string }>;
  isRead: boolean;
  readAt: string | null;
  toolCalls: unknown[];
  sourceChunkIds: string[];
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
}

interface Escalation {
  id: string;
  status: string;
  priority: string;
  reason: string | null;
  triggerType: string | null;
  resolution: string | null;
  returnedToAi: boolean;
  createdAt: string;
  resolvedAt: string | null;
  assignedUser: { id: string; name: string | null } | null;
}

interface PreviousConversation {
  id: string;
  subject: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  satisfactionRating: number | null;
}

interface Conversation {
  id: string;
  status: string;
  subject: string | null;
  channel: string;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  sentiment: number | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  pageUrl: string | null;
  referrer: string | null;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  resolvedAt: string | null;
  resolutionType: string | null;
  endUser: EndUser | null;
  agent: Agent | null;
  assignedUser: AssignedUser | null;
}

interface ConversationData {
  conversation: Conversation;
  messages: Message[];
  escalationHistory: Escalation[];
  previousConversations: PreviousConversation[];
}

export default function LiveChatPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;

  const [data, setData] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showCustomerInfo, setShowCustomerInfo] = useState(true);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [closingMessage, setClosingMessage] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch conversation data
  const fetchConversation = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/support-agent/conversations/${conversationId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch conversation");
      }
      const result: ConversationData = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages]);

  // Send message
  const sendMessage = async () => {
    if (!messageInput.trim() || sending) return;

    setSending(true);
    try {
      const response = await fetch(
        `/api/support-agent/conversations/${conversationId}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: messageInput }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const result = await response.json();

      // Add message to local state
      if (data) {
        setData({
          ...data,
          messages: [
            ...data.messages,
            {
              id: result.message.id,
              role: "human_agent",
              type: "text",
              content: result.message.content,
              attachments: [],
              isRead: false,
              readAt: null,
              toolCalls: [],
              sourceChunkIds: [],
              metadata: null,
              createdAt: result.message.createdAt,
              user: {
                id: result.message.userId,
                name: result.message.userName,
                email: "",
              },
            },
          ],
        });
      }

      setMessageInput("");
      inputRef.current?.focus();
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  // Add note
  const addNote = async () => {
    if (!noteContent.trim()) return;

    try {
      await fetch(`/api/support-agent/conversations/${conversationId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent, isNote: true }),
      });

      setNoteContent("");
      setShowNoteModal(false);
      fetchConversation();
    } catch (err) {
      console.error("Failed to add note:", err);
    }
  };

  // Resolve conversation
  const resolveConversation = async () => {
    try {
      await fetch(`/api/support-agent/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          data: {
            resolutionType: "resolved",
            closingMessage: closingMessage.trim() || undefined,
          },
        }),
      });

      setShowResolveModal(false);
      router.push("/inbox");
    } catch (err) {
      console.error("Failed to resolve conversation:", err);
    }
  };

  // Return to AI
  const returnToAi = async () => {
    try {
      await fetch(`/api/support-agent/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "returnToAi" }),
      });

      router.push("/inbox");
    } catch (err) {
      console.error("Failed to return to AI:", err);
    }
  };

  // Toggle star
  const toggleStar = async () => {
    if (!data) return;

    try {
      await fetch(`/api/support-agent/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: data.conversation.isStarred ? "unstar" : "star",
        }),
      });

      setData({
        ...data,
        conversation: {
          ...data.conversation,
          isStarred: !data.conversation.isStarred,
        },
      });
    } catch (err) {
      console.error("Failed to toggle star:", err);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Get message icon
  const getMessageIcon = (role: Message["role"]) => {
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
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-danger">
        <AlertCircle size={48} className="opacity-50 mb-4" />
        <p className="text-lg font-medium">Failed to load conversation</p>
        <p className="text-sm text-default-500 mt-1">{error}</p>
        <Button variant="ghost" onClick={() => router.push("/inbox")} className="mt-4">
          Back to Inbox
        </Button>
      </div>
    );
  }

  const { conversation, messages, previousConversations } = data;
  const isResolved = conversation.status === "resolved" || conversation.status === "abandoned";

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-divider bg-content1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/inbox")}>
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
                  {conversation.endUser?.name ?? "Anonymous"}
                </h2>
                <Badge
                  variant={isResolved ? "default" : "success"}
                  className="text-xs"
                >
                  {isResolved ? "Resolved" : "Active"}
                </Badge>
              </div>
              <p className="text-sm text-default-500">
                Started {formatDistanceToNow(new Date(conversation.createdAt), { addSuffix: true })}
                {conversation.agent && ` • via ${conversation.agent.name}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleStar}>
              {conversation.isStarred ? (
                <Star size={20} className="fill-warning text-warning" />
              ) : (
                <StarOff size={20} />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCustomerInfo(!showCustomerInfo)}
              className="hidden md:flex"
            >
              <User size={20} />
            </Button>

            <Dropdown
              trigger={
                <Button variant="ghost" size="sm">
                  <MoreVertical size={20} />
                </Button>
              }
              items={[
                { key: "profile", label: showCustomerInfo ? "Hide Customer Info" : "Show Customer Info" },
                { key: "history", label: "View Full History" },
                { key: "transfer", label: "Transfer to Agent" },
                { key: "tag", label: "Add Tag" },
              ] satisfies DropdownMenuItem[]}
              onAction={(key) => {
                if (key === "profile") setShowCustomerInfo(!showCustomerInfo);
              }}
            />
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
                <div className="text-xs text-default-400 bg-default-100 px-3 py-1 rounded-full">
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

                    <p className="whitespace-pre-wrap break-words">{message.content}</p>

                    <div className="flex items-center justify-end gap-1 mt-1 text-xs opacity-60">
                      <span>{format(new Date(message.createdAt), "HH:mm")}</span>
                      {message.role === "human_agent" && (
                        message.isRead ? (
                          <CheckCheck size={14} className="text-primary" />
                        ) : (
                          <Check size={14} />
                        )
                      )}
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
          <div className="border-t border-divider p-4 bg-content1">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-shrink-0">
                <Paperclip size={20} />
              </Button>
              <Button variant="ghost" size="sm" className="flex-shrink-0">
                <Smile size={20} />
              </Button>

              <Textarea
                ref={inputRef}
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyDown}
                minRows={1}
                maxRows={4}
                className="flex-1"
              />

              <Button
                color="primary"
                size="sm"
                onClick={sendMessage}
                isLoading={sending}
                isDisabled={!messageInput.trim()}
                className="flex-shrink-0"
              >
                <Send size={20} />
              </Button>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-divider">
              <div className="flex gap-2">
                <Button
                  variant="flat"
                  size="sm"
                  color="secondary"
                  onClick={returnToAi}
                >
                  <Bot size={16} />
                  Return to AI
                </Button>
                <Button
                  variant="flat"
                  size="sm"
                  onClick={() => setShowNoteModal(true)}
                >
                  <FileText size={16} />
                  Add Note
                </Button>
              </div>

              <Button
                color="success"
                size="sm"
                onClick={() => setShowResolveModal(true)}
              >
                <Check size={16} />
                Resolve
              </Button>
            </div>
          </div>
        )}

        {/* Resolved Banner */}
        {isResolved && (
          <div className="border-t border-divider p-4 bg-default-100 text-center">
            <p className="text-default-500">
              This conversation was resolved{" "}
              {conversation.resolvedAt &&
                formatDistanceToNow(new Date(conversation.resolvedAt), { addSuffix: true })}
            </p>
          </div>
        )}
      </div>

      {/* Customer Info Sidebar */}
      {showCustomerInfo && (
        <div className="w-80 border-l border-divider bg-content1 overflow-y-auto hidden md:block">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Customer Info</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowCustomerInfo(false)}>
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
              <h4 className="font-medium">{conversation.endUser?.name ?? "Anonymous"}</h4>
              {conversation.endUser?.email && (
                <p className="text-sm text-default-500">{conversation.endUser.email}</p>
              )}

              {/* Tags */}
              {(conversation.tags as string[])?.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center mt-2">
                  {(conversation.tags as string[]).map((tag) => (
                    <Chip key={tag} size="sm" variant="flat">
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
                  <Mail size={16} className="text-default-400" />
                  <span>{conversation.endUser.email}</span>
                </div>
              )}
              {conversation.endUser?.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={16} className="text-default-400" />
                  <span>{conversation.endUser.phone}</span>
                </div>
              )}
              {conversation.pageUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe size={16} className="text-default-400" />
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
                <Calendar size={16} className="text-default-400" />
                <span>
                  Customer since{" "}
                  {conversation.endUser?.createdAt &&
                    format(new Date(conversation.endUser.createdAt), "MMM d, yyyy")}
                </span>
              </div>
            </div>

            <Divider className="my-4" />

            {/* Conversation Stats */}
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-default-500">Conversation Stats</h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-default-100 rounded-lg p-2 text-center">
                  <p className="font-semibold">{conversation.messageCount}</p>
                  <p className="text-xs text-default-500">Messages</p>
                </div>
                <div className="bg-default-100 rounded-lg p-2 text-center">
                  <p className="font-semibold">{conversation.endUser?.totalConversations ?? 1}</p>
                  <p className="text-xs text-default-500">Total Chats</p>
                </div>
              </div>
            </div>

            {/* Previous Conversations */}
            {previousConversations.length > 0 && (
              <>
                <Divider className="my-4" />
                <div>
                  <h5 className="text-sm font-medium text-default-500 mb-2">
                    Previous Conversations
                  </h5>
                  <div className="space-y-2">
                    {previousConversations.slice(0, 5).map((prev) => (
                      <button
                        key={prev.id}
                        onClick={() => router.push(`/inbox/${prev.id}`)}
                        className="w-full text-left p-2 rounded-lg hover:bg-default-100 transition-colors text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">
                            {prev.subject ?? "No subject"}
                          </span>
                          <Badge
                            variant={prev.status === "resolved" ? "success" : "default"}
                            className="text-xs"
                          >
                            {prev.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-default-400 mt-1">
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
            <p className="text-sm text-default-500 mb-4">
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
            <Button variant="ghost" onClick={() => setShowResolveModal(false)}>
              Cancel
            </Button>
            <Button color="success" onClick={resolveConversation}>
              Resolve
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Note Modal */}
      <Modal isOpen={showNoteModal} onClose={() => setShowNoteModal(false)}>
        <ModalContent>
          <ModalHeader>Add Internal Note</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-500 mb-4">
              This note is only visible to your team, not the customer.
            </p>
            <Textarea
              label="Note"
              placeholder="Enter your note..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              minRows={3}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowNoteModal(false)}>
              Cancel
            </Button>
            <Button color="primary" onClick={addNote} isDisabled={!noteContent.trim()}>
              Add Note
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
