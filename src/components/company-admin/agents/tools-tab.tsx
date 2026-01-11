"use client";

import { useState } from "react";
import {
  Search,
  UserPlus,
  Mail,
  Calendar,
  Database,
  Ticket,
  Settings,
  FolderOpen,
} from "lucide-react";

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Switch,
  Checkbox,
} from "@/components/ui";

import type { ChatbotDetail } from "@/hooks/company/useChatbots";
import { useKnowledgeCategories } from "@/hooks/company/useKnowledge";

interface ToolsTabProps {
  agent: ChatbotDetail;
  onSave: (data: Partial<ChatbotDetail>) => Promise<void>;
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
  const { categories } = useKnowledgeCategories();

  // Initialize tools with defaults, merged with agent's config
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>(
    () => ({
      knowledgeSearch: true,
      escalateToHuman: true,
      sendEmail: false,
      scheduleMeeting: false,
      crmLookup: false,
      createTicket: false,
      ...((agent.behavior as { enabledTools?: Record<string, boolean> })
        ?.enabledTools ?? {}),
    })
  );

  // Initialize selected categories from agent's config
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set(agent.knowledgeCategories ?? [])
  );

  const handleToggle = (toolId: string, enabled: boolean) => {
    setEnabledTools((prev) => ({ ...prev, [toolId]: enabled }));
  };

  const handleCategoryToggle = (categoryName: string, checked: boolean) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(categoryName);
      } else {
        next.delete(categoryName);
      }
      return next;
    });
  };

  const handleSave = async () => {
    await onSave({
      knowledgeCategories: Array.from(selectedCategories),
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
          <p className="text-sm text-muted-foreground">
            Enable tools that your agent can use during conversations.
          </p>

          {Object.entries(toolsByCategory).map(([category, tools]) => (
            <div key={category} className="space-y-4">
              <h3 className="font-medium border-b pb-2">
                {CATEGORY_LABELS[category]}
              </h3>
              <div className="space-y-4">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  const isKnowledgeSearch = tool.id === "knowledgeSearch";
                  const showCategoryFilter = isKnowledgeSearch && tool.enabled && categories.length > 0;

                  return (
                    <div key={tool.id} className="space-y-0">
                      <div className="flex items-start justify-between rounded-lg border p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{tool.name}</span>
                              {tool.requiresIntegration && (
                                <Badge variant="secondary">
                                  Requires integration
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {tool.description}
                            </p>
                            {tool.requiresIntegration && (
                              <p className="text-xs text-muted-foreground mt-1">
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
                            variant="ghost"
                            size="icon"
                            isDisabled
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Category Filter for Knowledge Search */}
                      {showCategoryFilter && (
                        <div className="ml-4 border-l-2 border-muted pl-4 py-3 bg-muted/30 rounded-b-lg -mt-1">
                          <div className="flex items-center gap-2 mb-3">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Filter by categories</span>
                            {selectedCategories.size === 0 && (
                              <Badge variant="secondary" className="text-xs">
                                All categories
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            Select categories to limit knowledge search. Leave empty to search all.
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {categories.map((category) => (
                              <Checkbox
                                key={category.name}
                                isSelected={selectedCategories.has(category.name)}
                                onValueChange={(checked) =>
                                  handleCategoryToggle(category.name, checked)
                                }
                              >
                                <span className="text-sm">{category.name}</span>
                              </Checkbox>
                            ))}
                          </div>
                        </div>
                      )}
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
