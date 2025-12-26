"use client";

import { useState, use } from "react";
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
} from "lucide-react";

import {
  Button,
  Dropdown,
  type DropdownMenuItemData,
  Badge,
  Spinner,
  Input,
  addToast,
} from "@/components/ui";
import {
  useConversation,
  useConversationMessages,
  useSendMessage,
  useUpdateConversation,
} from "@/hooks/company";
import { MessageThread } from "@/components/company-admin/conversations/message-thread";
import { CustomerSidebar } from "@/components/company-admin/conversations/customer-sidebar";

type StatusConfig = {
  label: string;
  variant: "default" | "success" | "warning" | "danger" | "info";
  icon: React.ComponentType<{ className?: string }>;
};

const defaultStatus: StatusConfig = { label: "Active", variant: "info", icon: MessageSquare };

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

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default function ConversationDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { conversationId } = use(params);

  const [messageInput, setMessageInput] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);

  const { conversation, isLoading: isLoadingConversation, mutate: mutateConversation } = useConversation(conversationId);
  const { messages, isLoading: isLoadingMessages, mutate: mutateMessages } = useConversationMessages(conversationId);
  const { sendMessage, isSending } = useSendMessage(conversationId);
  const { updateConversation, isUpdating } = useUpdateConversation(conversationId);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return;

    try {
      await sendMessage({ content: messageInput.trim() });
      setMessageInput("");
      mutateMessages();
      mutateConversation();
    } catch {
      addToast({
        title: "Failed to send message",
        color: "danger",
      });
    }
  };

  const handleResolve = async () => {
    try {
      await updateConversation({
        status: "resolved",
        resolutionType: "human",
      });
      mutateConversation();
      addToast({
        title: "Conversation resolved",
        color: "success",
      });
    } catch {
      addToast({
        title: "Failed to resolve conversation",
        color: "danger",
      });
    }
  };

  const handleTakeOver = async () => {
    try {
      await updateConversation({
        status: "with_human",
      });
      mutateConversation();
      addToast({
        title: "You are now handling this conversation",
        color: "success",
      });
    } catch {
      addToast({
        title: "Failed to take over conversation",
        color: "danger",
      });
    }
  };

  const handleReturnToAI = async () => {
    try {
      await updateConversation({
        status: "active",
        assignedUserId: null,
      });
      mutateConversation();
      addToast({
        title: "Conversation returned to AI",
        color: "success",
      });
    } catch {
      addToast({
        title: "Failed to return conversation to AI",
        color: "danger",
      });
    }
  };

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
        handleResolve();
        break;
    }
  };

  if (isLoadingConversation) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground font-medium">Conversation not found</p>
        <Button variant="outline" className="mt-4" onPress={() => router.push("/conversations")}>
          Back to Conversations
        </Button>
      </div>
    );
  }

  const status = getStatusConfig(conversation.status);
  const StatusIcon = status.icon;
  const isResolved = conversation.status === "resolved" || conversation.status === "abandoned";

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-divider bg-background">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onPress={() => router.push("/conversations")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold">
                {conversation.endUser.name ||
                  conversation.endUser.email ||
                  "Anonymous Customer"}
              </h1>
              <Badge variant={status.variant}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {conversation.agent.name} · {conversation.messageCount} messages ·{" "}
              {conversation.channel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isResolved && (
            <>
              <Button
                color="success"
                variant="outline"
                size="sm"
                onPress={handleResolve}
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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Message Thread */}
        <div className="flex-1 flex flex-col">
          <MessageThread
            messages={messages}
            isLoading={isLoadingMessages}
            customerName={conversation.endUser.name}
          />

          {/* Message Input */}
          {!isResolved && (
            <div className="p-4 border-t border-divider bg-background">
              <div className="flex gap-2 max-w-3xl mx-auto">
                <Input
                  placeholder="Type a message as human agent..."
                  value={messageInput}
                  onValueChange={setMessageInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isSending}
                  className="flex-1"
                />
                <Button
                  color="primary"
                  size="icon"
                  onPress={handleSendMessage}
                  isLoading={isSending}
                  disabled={!messageInput.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Messages you send will appear as from a human agent
              </p>
            </div>
          )}

          {isResolved && (
            <div className="p-4 border-t border-divider bg-muted text-center">
              <p className="text-sm text-muted-foreground">
                This conversation has been {conversation.status}.
                {conversation.resolvedAt && (
                  <span>
                    {" "}
                    Resolved on{" "}
                    {new Date(conversation.resolvedAt).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Customer Sidebar */}
        {showSidebar && <CustomerSidebar conversation={conversation} />}
      </div>
    </div>
  );
}
