"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Bug } from "lucide-react";

import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Switch,
  ScrollArea,
  Spinner,
} from "@/components/ui";
import { useTestChatbot } from "@/hooks/company";

interface TestChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  tokensUsed?: number;
}

export function TestChatModal({
  isOpen,
  onClose,
  agentId,
  agentName,
}: TestChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { testChatbot, isTesting } = useTestChatbot(agentId);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Reset chat when modal opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset state when modal opens
      setMessages([]);
      setInput("");
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isTesting) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await testChatbot({
        message: userMessage.content,
        conversationHistory,
      });

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.response,
        reasoning: response.reasoning,
        tokensUsed: response.tokensUsed,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I encountered an error processing your message.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalContent className="h-[600px]">
        <ModalHeader className="flex items-center justify-between border-b border-divider">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <span>Test Chat - {agentName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              size="sm"
              isSelected={debugMode}
              onValueChange={setDebugMode}
            />
            <label className="text-sm cursor-pointer flex items-center gap-1">
              <Bug className="h-4 w-4" />
              Debug
            </label>
          </div>
        </ModalHeader>

        <ModalBody className="flex-1 flex flex-col p-0 gap-0">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Send a message to test your agent</p>
                  <p className="text-sm">
                    The agent will respond using its current configuration
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className="space-y-1">
                  <div
                    className={`flex gap-3 ${
                      message.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={`rounded-lg px-4 py-2 max-w-[80%] ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>

                  {/* Debug info */}
                  {debugMode && message.role === "assistant" && message.reasoning && (
                    <div className="ml-11 mt-1 p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                      <div className="font-medium mb-1">Debug Info:</div>
                      <div>{message.reasoning}</div>
                      {message.tokensUsed && (
                        <div className="mt-1">Tokens used: {message.tokensUsed}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isTesting && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-lg px-4 py-2 bg-muted">
                    <Spinner size="sm" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-divider">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={input}
                onValueChange={setInput}
                onKeyDown={handleKeyDown}
                isDisabled={isTesting}
              />
              <Button
                color="primary"
                onPress={handleSend}
                isDisabled={!input.trim() || isTesting}
                size="icon"
              >
                {isTesting ? (
                  <Spinner size="sm" color="current" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              This is a test environment. Responses use the current agent configuration.
            </p>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
