"use client";

import {
  Settings,
  Thermometer,
  MessageSquareText,
  Wrench,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

import { ScrollArea, Badge } from "@/components/ui";
import type { AgentDetail, AgentListItemConfig } from "@/hooks/company";

interface TestConfigSidebarProps {
  agent: AgentDetail;
  agentConfig?: AgentListItemConfig;
}

export function TestConfigSidebar({
  agent,
  agentConfig,
}: TestConfigSidebarProps) {
  const [promptExpanded, setPromptExpanded] = useState(false);

  // Get model display name
  const modelId = agentConfig?.default_model_id || agent.modelId || "gpt-4o-mini";
  // Temperature is now stored in model_settings as 0-1, convert to percentage for display
  // agent.temperature is still in 0-100 scale for backward compatibility
  const temperatureValue = (agentConfig?.model_settings?.temperature as number) ?? (agent.temperature ? agent.temperature / 100 : 0.7);
  const temperaturePercent = Math.round(temperatureValue * 100);
  const systemPrompt =
    agentConfig?.default_system_prompt || agent.systemPrompt || "No system prompt set";

  // Get enabled tools from behavior
  const enabledTools = agent.behavior?.enabledTools || {};
  const toolsList = Object.entries(enabledTools)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);

  return (
    <div className="w-80 border-l border-divider bg-muted/30 flex flex-col">
      <div className="px-4 py-3 border-b border-divider">
        <h2 className="font-semibold flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Agent Configuration
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Current settings for this agent
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Model */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Model
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {modelId}
              </Badge>
            </div>
          </div>

          {/* Temperature */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Thermometer className="h-3 w-3" />
              Temperature
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${temperaturePercent}%` }}
                />
              </div>
              <span className="text-sm font-mono w-12 text-right">
                {temperatureValue.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {temperaturePercent < 30
                ? "More focused and deterministic"
                : temperaturePercent < 70
                  ? "Balanced creativity and focus"
                  : "More creative and varied"}
            </p>
          </div>

          {/* System Prompt */}
          <div>
            <button
              onClick={() => setPromptExpanded(!promptExpanded)}
              className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1">
                <MessageSquareText className="h-3 w-3" />
                System Prompt
              </span>
              {promptExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            <div
              className={`text-sm bg-muted rounded-lg p-3 overflow-hidden transition-all ${
                promptExpanded ? "max-h-96" : "max-h-24"
              }`}
            >
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                {systemPrompt}
              </pre>
            </div>
            {!promptExpanded && systemPrompt.length > 200 && (
              <button
                onClick={() => setPromptExpanded(true)}
                className="text-xs text-primary hover:underline mt-1"
              >
                Show more
              </button>
            )}
          </div>

          {/* Tools */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              Enabled Tools ({toolsList.length})
            </div>
            {toolsList.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {toolsList.map((tool) => (
                  <Badge key={tool} variant="default" className="text-xs">
                    {formatToolName(tool)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tools enabled</p>
            )}
          </div>

          {/* Knowledge Categories */}
          {agent.knowledgeCategories && agent.knowledgeCategories.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Knowledge Categories
              </div>
              <div className="flex flex-wrap gap-1">
                {agent.knowledgeCategories.map((category) => (
                  <Badge key={category} variant="default" className="text-xs">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Behavior Settings */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Behavior
            </div>
            <div className="space-y-2 text-sm">
              {agent.behavior?.greeting && (
                <div className="bg-muted rounded-lg p-2">
                  <div className="text-xs text-muted-foreground mb-1">
                    Greeting
                  </div>
                  <p className="text-xs">{agent.behavior.greeting}</p>
                </div>
              )}
              {agent.behavior?.fallbackMessage && (
                <div className="bg-muted rounded-lg p-2">
                  <div className="text-xs text-muted-foreground mb-1">
                    Fallback
                  </div>
                  <p className="text-xs">{agent.behavior.fallbackMessage}</p>
                </div>
              )}
              {agent.behavior?.maxTurnsBeforeEscalation && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Max turns before escalation
                  </span>
                  <span>{agent.behavior.maxTurnsBeforeEscalation}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function formatToolName(tool: string): string {
  return tool
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
