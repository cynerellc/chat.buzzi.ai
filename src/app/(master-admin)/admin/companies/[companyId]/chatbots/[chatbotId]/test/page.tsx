"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Send,
  RefreshCw,
  User,
  Loader2,
  Settings,
  Bug,
  Database,
  Cpu,
  Clock,
  Wrench,
  ChevronDown,
  ChevronUp,
  Zap,
  Brain,
  AlertCircle,
  Bell,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Skeleton,
  Badge,
  addToast,
  Separator,
  Switch,
} from "@/components/ui";

import { useChatbotContext } from "../chatbot-context";
import type { AgentListItem } from "@/lib/db/schema/chatbots";

// Message types for the thread
type ThreadItemType = "user" | "assistant" | "event";

interface ThreadItem {
  id: string;
  type: ThreadItemType;
  timestamp: Date;
  // For user/assistant messages
  content?: string;
  agentName?: string;
  agentAvatar?: string;
  isStreaming?: boolean;
  // For SSE events
  eventType?: string;
  eventData?: unknown;
}

interface DebugInfo {
  sessionId: string;
  chatbotId: string;
  agentIdentifier: string;
  model: string;
  temperature: number;
  knowledgeBaseEnabled: boolean;
  knowledgeCategories: string[];
  historyLength: number;
}

export default function TestChatbotPage() {
  const { companyId, chatbotId, chatbot, isLoading: chatbotLoading } = useChatbotContext();

  const [threadItems, setThreadItems] = useState<ThreadItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(true);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [debugPanelExpanded, setDebugPanelExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);

  const agentsList = (chatbot?.agentsList as AgentListItem[]) ?? [];

  // Auto-scroll to bottom when new items arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadItems]);

  // Initialize session
  useEffect(() => {
    if (chatbot && !sessionId) {
      const newSessionId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      setSessionId(newSessionId);
    }
  }, [chatbot, sessionId]);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading || !chatbot || !sessionId) return;

    const userItem: ThreadItem = {
      id: `user-${Date.now()}`,
      type: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setThreadItems((prev) => [...prev, userItem]);
    setInputValue("");
    setIsLoading(true);

    // Create placeholder for assistant message
    const assistantId = `assistant-${Date.now()}`;
    currentAssistantIdRef.current = assistantId;

    const placeholderItem: ThreadItem = {
      id: assistantId,
      type: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };
    setThreadItems((prev) => [...prev, placeholderItem]);

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `/api/master-admin/companies/${companyId}/chatbots/${chatbotId}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userItem.content,
            sessionId,
            debug: debugEnabled,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let currentContent = "";
      let currentAgentName: string | undefined;
      let currentAgentAvatar: string | undefined;
      let lastEventType: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            lastEventType = line.slice(7).trim();
            continue;
          }
          if (line.startsWith("data: ") && lastEventType) {
            try {
              const data = JSON.parse(line.slice(6));

              // Log events to the thread (skip delta - it updates the message directly)
              if (lastEventType !== "delta") {
                const eventItem: ThreadItem = {
                  id: `event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  type: "event",
                  timestamp: new Date(),
                  eventType: lastEventType,
                  eventData: data,
                };

                // Insert event before the assistant message placeholder
                setThreadItems((prev) => {
                  const idx = prev.findIndex((item) => item.id === assistantId);
                  if (idx === -1) return [...prev, eventItem];
                  return [...prev.slice(0, idx), eventItem, ...prev.slice(idx)];
                });
              }

              // Handle specific events for UI updates
              switch (lastEventType) {
                case "agent":
                  currentAgentName = data.name;
                  currentAgentAvatar = data.avatar_url;
                  setThreadItems((prev) =>
                    prev.map((item) =>
                      item.id === assistantId
                        ? { ...item, agentName: data.name, agentAvatar: data.avatar_url }
                        : item
                    )
                  );
                  break;

                case "debug":
                  setDebugInfo(data);
                  break;

                case "delta":
                  currentContent += data.content;
                  setThreadItems((prev) =>
                    prev.map((item) =>
                      item.id === assistantId
                        ? { ...item, content: currentContent }
                        : item
                    )
                  );
                  break;

                case "complete":
                  currentContent = data.content;
                  setThreadItems((prev) =>
                    prev.map((item) =>
                      item.id === assistantId
                        ? {
                            ...item,
                            content: data.content,
                            isStreaming: false,
                            agentName: currentAgentName,
                            agentAvatar: currentAgentAvatar,
                          }
                        : item
                    )
                  );
                  break;

                case "error":
                  throw new Error(data.message || data.error);
              }
              lastEventType = null;
            } catch (e) {
              // Skip malformed JSON
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;

      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get response",
        color: "danger",
      });

      setThreadItems((prev) =>
        prev.map((item) =>
          item.id === currentAssistantIdRef.current
            ? {
                ...item,
                content: "Sorry, there was an error processing your message. Please try again.",
                isStreaming: false,
              }
            : item
        )
      );
    } finally {
      setIsLoading(false);
      currentAssistantIdRef.current = null;
    }
  }, [inputValue, isLoading, chatbot, sessionId, companyId, chatbotId, debugEnabled]);

  const handleResetConversation = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (sessionId) {
      try {
        await fetch(
          `/api/master-admin/companies/${companyId}/chatbots/${chatbotId}/test?sessionId=${sessionId}`,
          { method: "DELETE" }
        );
      } catch {
        // Ignore errors
      }
    }

    setThreadItems([]);
    setDebugInfo(null);
    const newSessionId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    setSessionId(newSessionId);
    addToast({
      title: "Conversation Reset",
      description: "Started a new test conversation",
      color: "success",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getAgentAvatar = (item: ThreadItem) => {
    if (item.agentAvatar) {
      return (
        <img
          src={item.agentAvatar}
          alt={item.agentName || "Agent"}
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }
    return (
      <div className="p-2 bg-primary/10 rounded-full">
        <Bot className="w-4 h-4 text-primary" />
      </div>
    );
  };

  // Get color scheme for event type
  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "agent":
        return { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400", icon: "text-indigo-500" };
      case "debug":
        return { bg: "bg-slate-500/10", border: "border-slate-500/20", text: "text-slate-600 dark:text-slate-400", icon: "text-slate-500" };
      case "thinking":
        return { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-600 dark:text-blue-400", icon: "text-blue-500" };
      case "tool_call":
        return { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-600 dark:text-amber-400", icon: "text-amber-500" };
      case "notification":
        return { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-600 dark:text-purple-400", icon: "text-purple-500" };
      case "complete":
        return { bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-600 dark:text-green-400", icon: "text-green-500" };
      case "error":
        return { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-600 dark:text-red-400", icon: "text-red-500" };
      default:
        return { bg: "bg-gray-500/10", border: "border-gray-500/20", text: "text-gray-600 dark:text-gray-400", icon: "text-gray-500" };
    }
  };

  // Get icon for event type
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "agent":
        return <ArrowRight className="w-3 h-3" />;
      case "debug":
        return <Bug className="w-3 h-3" />;
      case "thinking":
        return <Brain className="w-3 h-3 animate-pulse" />;
      case "tool_call":
        return <Wrench className="w-3 h-3" />;
      case "notification":
        return <Bell className="w-3 h-3" />;
      case "complete":
        return <CheckCircle className="w-3 h-3" />;
      case "error":
        return <AlertCircle className="w-3 h-3" />;
      default:
        return <Database className="w-3 h-3" />;
    }
  };

  const renderThreadItem = (item: ThreadItem) => {
    switch (item.type) {
      case "user":
        return (
          <div key={item.id} className="flex gap-3 justify-end">
            <div className="max-w-[70%]">
              <div className="rounded-lg p-3 bg-primary text-primary-foreground">
                <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                <p className="text-xs mt-1 text-primary-foreground/70">
                  {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
            <div className="p-2 bg-primary rounded-full h-fit">
              <User className="w-4 h-4 text-primary-foreground" />
            </div>
          </div>
        );

      case "assistant":
        return (
          <div key={item.id} className="flex gap-3 justify-start">
            {getAgentAvatar(item)}
            <div className="max-w-[70%]">
              {item.agentName && (
                <p className="text-xs text-muted-foreground mb-1 ml-1">{item.agentName}</p>
              )}
              <div className="rounded-lg p-3 bg-muted">
                <p className="text-sm whitespace-pre-wrap">
                  {item.content || (item.isStreaming && (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Waiting for response...
                    </span>
                  ))}
                </p>
                <p className="text-xs mt-1 text-muted-foreground">
                  {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          </div>
        );

      case "event": {
        const colors = getEventColor(item.eventType || "");
        return (
          <div
            key={item.id}
            className={`mx-4 rounded-lg border overflow-hidden ${colors.bg} ${colors.border}`}
          >
            <div className={`flex items-center gap-2 px-3 py-1.5 ${colors.bg}`}>
              <span className={colors.icon}>{getEventIcon(item.eventType || "")}</span>
              <span className={`text-xs font-mono font-medium ${colors.text}`}>
                {item.eventType}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
            <div className="px-3 py-2 bg-background/50">
              <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                {String(JSON.stringify(item.eventData, null, 2))}
              </pre>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (chatbotLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Test Chatbot</h2>
          <p className="text-sm text-muted-foreground">Test your chatbot configuration</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-[600px] rounded-lg" />
          </div>
          <div>
            <Skeleton className="h-[600px] rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Test Chatbot</h2>
          <p className="text-sm text-muted-foreground">
            Test {chatbot?.name} in a sandbox environment
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Debug</span>
            <Switch checked={debugEnabled} onCheckedChange={setDebugEnabled} />
          </div>
          <Button variant="outline" leftIcon={RefreshCw} onPress={handleResetConversation}>
            Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Window */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{chatbot?.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {agentsList.length} agent{agentsList.length !== 1 ? "s" : ""} • Auto-routing enabled
                  </p>
                </div>
              </div>
              <Badge variant="info">Sandbox</Badge>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col h-[500px]">
            {/* Thread Area */}
            <div className="flex-1 overflow-y-auto space-y-3 p-4">
              {threadItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Bot className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <h4 className="font-medium text-muted-foreground mb-2">
                    Start a Test Conversation
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Send a message to test how your chatbot responds. Agent switching is handled
                    automatically by the supervisor agent. All events will be displayed inline.
                  </p>
                </div>
              ) : (
                threadItems.map(renderThreadItem)
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={isLoading || !chatbot}
                  className="flex-1"
                />
                <Button
                  color="primary"
                  onPress={handleSendMessage}
                  isDisabled={!inputValue.trim() || isLoading || !chatbot}
                  isLoading={isLoading}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Debug & Info Panel */}
        <div className="space-y-4">
          {/* Debug Panel */}
          {debugEnabled && (
            <Card>
              <CardHeader
                className="cursor-pointer"
                onClick={() => setDebugPanelExpanded(!debugPanelExpanded)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bug className="w-4 h-4 text-amber-500" />
                    <h3 className="font-medium">Debug Info</h3>
                  </div>
                  {debugPanelExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </CardHeader>
              {debugPanelExpanded && (
                <CardBody className="space-y-4 text-sm">
                  {debugInfo ? (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Model
                        </p>
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-muted-foreground" />
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {debugInfo.model}
                          </code>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Temperature
                        </p>
                        <p>{debugInfo.temperature}%</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          Knowledge Base
                        </p>
                        <Badge
                          variant={debugInfo.knowledgeBaseEnabled ? "success" : "default"}
                          size="sm"
                        >
                          {debugInfo.knowledgeBaseEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                        {debugInfo.knowledgeBaseEnabled && debugInfo.knowledgeCategories.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {debugInfo.knowledgeCategories.map((cat) => (
                              <Badge key={cat} variant="secondary" size="sm">
                                {cat}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {debugInfo.knowledgeBaseEnabled && debugInfo.knowledgeCategories.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-1">All categories</p>
                        )}
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                          History
                        </p>
                        <p>{debugInfo.historyLength} messages</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      Send a message to see debug info
                    </p>
                  )}
                </CardBody>
              )}
            </Card>
          )}

          {/* Configuration Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-medium">Configuration</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Chatbot
                </p>
                <p className="font-medium">{chatbot?.name}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Status
                </p>
                <Badge
                  variant={
                    chatbot?.status === "active"
                      ? "success"
                      : chatbot?.status === "paused"
                      ? "warning"
                      : "default"
                  }
                >
                  {chatbot?.status}
                </Badge>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Agents ({agentsList.length})
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  Agent routing handled automatically
                </p>
                <div className="space-y-2 mt-2">
                  {agentsList.map((agent) => (
                    <div
                      key={agent.agent_identifier}
                      className="flex items-center gap-2 p-2 rounded bg-muted/50"
                    >
                      {agent.avatar_url ? (
                        <img
                          src={agent.avatar_url}
                          alt={agent.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <Bot className="w-4 h-4 text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{agent.name}</p>
                        {agent.knowledge_base_enabled && (
                          <p className="text-xs text-muted-foreground">
                            KB: {agent.knowledge_categories?.length || "All"} categories
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" size="sm">
                        {agent.agent_type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Session Info */}
          {sessionId && (
            <Card>
              <CardBody>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Session ID
                </p>
                <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                  {sessionId}
                </code>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
