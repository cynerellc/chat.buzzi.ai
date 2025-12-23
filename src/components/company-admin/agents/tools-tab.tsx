"use client";

import { useState, useEffect } from "react";
import {
  Search,
  UserPlus,
  Mail,
  Calendar,
  Database,
  Ticket,
  Settings,
} from "lucide-react";
import { Switch } from "@heroui/react";

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Chip,
} from "@/components/ui";

import type { AgentDetail } from "@/hooks/company/useAgents";

interface ToolsTabProps {
  agent: AgentDetail;
  onSave: (data: Partial<AgentDetail>) => Promise<void>;
  isSaving: boolean;
}

interface ToolConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "knowledge" | "communication" | "scheduling" | "crm";
  requiresIntegration?: string;
  enabled: boolean;
}

const AVAILABLE_TOOLS: Omit<ToolConfig, "enabled">[] = [
  {
    id: "knowledgeSearch",
    name: "Knowledge Base Search",
    description: "Search your uploaded documents and FAQs",
    icon: Search,
    category: "knowledge",
  },
  {
    id: "escalateToHuman",
    name: "Escalate to Human",
    description: "Transfer conversation to human agent",
    icon: UserPlus,
    category: "communication",
  },
  {
    id: "sendEmail",
    name: "Send Email",
    description: "Send emails to customers",
    icon: Mail,
    category: "communication",
    requiresIntegration: "Email",
  },
  {
    id: "scheduleMeeting",
    name: "Schedule Meeting",
    description: "Book meetings using calendar integration",
    icon: Calendar,
    category: "scheduling",
    requiresIntegration: "Google Calendar or Calendly",
  },
  {
    id: "crmLookup",
    name: "CRM Lookup",
    description: "Search customer data in connected CRM",
    icon: Database,
    category: "crm",
    requiresIntegration: "Salesforce, HubSpot, or Pipedrive",
  },
  {
    id: "createTicket",
    name: "Create Support Ticket",
    description: "Create tickets in ticketing system",
    icon: Ticket,
    category: "crm",
    requiresIntegration: "Zendesk, Freshdesk, or Linear",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  knowledge: "Knowledge & Search",
  communication: "Communication",
  scheduling: "Scheduling",
  crm: "CRM & Data",
};

export function ToolsTab({ agent, onSave, isSaving }: ToolsTabProps) {
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({
    knowledgeSearch: true,
    escalateToHuman: true,
    sendEmail: false,
    scheduleMeeting: false,
    crmLookup: false,
    createTicket: false,
  });

  useEffect(() => {
    // In a real app, tools config would be stored in agent.behavior or a separate field
    // For now, we'll use defaults
  }, [agent]);

  const handleToggle = (toolId: string, enabled: boolean) => {
    setEnabledTools((prev) => ({ ...prev, [toolId]: enabled }));
  };

  const handleSave = async () => {
    // In a real app, this would save the tools configuration
    await onSave({
      behavior: {
        ...(agent.behavior as Record<string, unknown>),
        enabledTools,
      } as typeof agent.behavior,
    });
  };

  // Group tools by category
  const toolsByCategory = AVAILABLE_TOOLS.reduce(
    (acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = [];
      }
      acc[tool.category]!.push({ ...tool, enabled: enabledTools[tool.id] || false });
      return acc;
    },
    {} as Record<string, ToolConfig[]>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Agent Tools</h2>
        </CardHeader>
        <CardBody className="space-y-6">
          <p className="text-sm text-default-500">
            Enable tools that your agent can use during conversations.
          </p>

          {Object.entries(toolsByCategory).map(([category, tools]) => (
            <div key={category} className="space-y-4">
              <h3 className="font-medium border-b border-divider pb-2">
                {CATEGORY_LABELS[category]}
              </h3>
              <div className="space-y-4">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <div
                      key={tool.id}
                      className="flex items-start justify-between rounded-lg border border-divider p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default-100">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{tool.name}</span>
                            {tool.requiresIntegration && (
                              <Chip size="sm" variant="bordered">
                                Requires integration
                              </Chip>
                            )}
                          </div>
                          <p className="text-sm text-default-500">
                            {tool.description}
                          </p>
                          {tool.requiresIntegration && (
                            <p className="text-xs text-default-400 mt-1">
                              Requires: {tool.requiresIntegration}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          isSelected={tool.enabled}
                          onValueChange={(checked) =>
                            handleToggle(tool.id, checked)
                          }
                          isDisabled={!!tool.requiresIntegration}
                        />
                        <Button
                          variant="light"
                          isIconOnly
                          size="sm"
                          isDisabled
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button color="primary" onPress={handleSave} isLoading={isSaving}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
