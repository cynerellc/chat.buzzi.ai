"use client";

import { Bot, ArrowRight } from "lucide-react";
import Link from "next/link";

import { Badge, Card } from "@/components/ui";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotAgentsPage() {
  const { chatbot, companyId, chatbotId } = useChatbotContext();

  const agentsList = chatbot?.agentsList ?? [];

  if (agentsList.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Agents Overview</h2>
          <p className="text-sm text-muted-foreground">
            Manage the agents that power this chatbot
          </p>
        </div>
        <Card className="p-12 text-center">
          <Bot size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-semibold mb-2">No Agents Configured</h3>
          <p className="text-muted-foreground">
            This chatbot doesn&apos;t have any agents in its configuration.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Agents Overview</h2>
        <p className="text-sm text-muted-foreground">
          Select an agent from the sidebar to view and edit its configuration
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {agentsList.map((agent) => (
          <Link
            key={agent.agent_identifier}
            href={`/admin/companies/${companyId}/chatbots/${chatbotId}/agents/${agent.agent_identifier}`}
          >
            <Card className="p-4 h-full transition-colors hover:bg-muted/50 hover:border-primary/50 cursor-pointer group">
              <div className="flex items-start gap-3">
                {agent.avatar_url ? (
                  <img
                    src={agent.avatar_url}
                    alt={agent.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot size={20} className="text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{agent.name}</span>
                    <Badge variant={agent.agent_type === "supervisor" ? "info" : "default"} size="sm">
                      {agent.agent_type}
                    </Badge>
                  </div>
                  {agent.designation && (
                    <p className="text-sm text-muted-foreground truncate mb-2">
                      {agent.designation}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Model: {agent.default_model_id}</span>
                    <span>Temp: {Math.round(((agent.model_settings?.temperature as number) ?? 0.7) * 100)}%</span>
                  </div>
                </div>
                <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-2" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
