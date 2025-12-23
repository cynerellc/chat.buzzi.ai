"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, X, ExternalLink } from "lucide-react";
import { Switch } from "@heroui/react";

import {
  Button,
  Input,
  Card,
  CardHeader,
  CardBody,
  Table,
  type Column,
} from "@/components/ui";

import type { AgentDetail } from "@/hooks/company/useAgents";

interface WidgetTabProps {
  agent: AgentDetail;
  onSave: (data: Partial<AgentDetail>) => Promise<void>;
  isSaving: boolean;
}

interface PageRule {
  id: string;
  pattern: string;
  agentName: string;
  [key: string]: unknown;
}

export function WidgetTab({ agent, onSave, isSaving }: WidgetTabProps) {
  const [isDefault, setIsDefault] = useState(false);
  const [pageRules, setPageRules] = useState<PageRule[]>([]);
  const [newPattern, setNewPattern] = useState("");

  useEffect(() => {
    // Load widget config from agent if available
    const behavior = agent.behavior as Record<string, unknown>;
    if (behavior?.widgetConfig) {
      const config = behavior.widgetConfig as { isDefault?: boolean; pageRules?: PageRule[] };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync state with prop changes
      setIsDefault(config.isDefault || false);
      setPageRules(config.pageRules || []);
    }
  }, [agent]);

  const tableColumns = useMemo((): Column<Record<string, unknown>>[] => [
    {
      key: "pattern",
      label: "URL Pattern",
      render: (rule) => <span className="font-mono text-sm">{String(rule.pattern)}</span>,
    },
    {
      key: "agentName",
      label: "Agent",
    },
    {
      key: "actions",
      label: " ",
      width: 50,
      render: (rule) => (
        <Button
          variant="light"
          isIconOnly
          size="sm"
          onPress={() => removePageRule(String(rule.id))}
        >
          <X className="h-4 w-4" />
        </Button>
      ),
    },
  ], []);

  const addPageRule = () => {
    if (newPattern.trim()) {
      setPageRules((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          pattern: newPattern.trim(),
          agentName: agent.name,
        },
      ]);
      setNewPattern("");
    }
  };

  const removePageRule = (id: string) => {
    setPageRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const handleSave = async () => {
    await onSave({
      behavior: {
        ...(agent.behavior as Record<string, unknown>),
        widgetConfig: {
          isDefault,
          pageRules,
        },
      } as typeof agent.behavior,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Widget Assignment</h2>
        </CardHeader>
        <CardBody className="space-y-6">
          <p className="text-sm text-default-500">
            This agent is assigned to handle conversations from the chat widget.
          </p>

          {/* Default Agent Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <span className="font-medium">Use as default widget agent</span>
              <p className="text-sm text-default-500">
                This agent will handle all new widget conversations
              </p>
            </div>
            <Switch isSelected={isDefault} onValueChange={setIsDefault} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Page-specific Assignment (Optional)</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-default-500">
            Assign different agents based on which page the visitor is on.
          </p>

          {pageRules.length > 0 && (
            <Table
              columns={tableColumns}
              data={pageRules as Record<string, unknown>[]}
              keyField={"id" as keyof Record<string, unknown>}
              aria-label="Page rules"
            />
          )}

          <div className="flex gap-2">
            <Input
              placeholder="e.g., /pricing/*, /support/*, /docs/*"
              value={newPattern}
              onValueChange={setNewPattern}
              onKeyDown={(e) => e.key === "Enter" && addPageRule()}
              classNames={{
                input: "font-mono",
              }}
            />
            <Button variant="bordered" onPress={addPageRule} leftIcon={Plus}>
              Add Rule
            </Button>
          </div>

          <div className="rounded-lg bg-default-100 p-4">
            <h4 className="font-medium mb-2">Pattern Examples</h4>
            <ul className="text-sm text-default-500 space-y-1">
              <li>
                <code className="bg-background px-1 rounded">/pricing/*</code> - Match all
                pricing pages
              </li>
              <li>
                <code className="bg-background px-1 rounded">/blog/**</code> - Match blog and
                all nested paths
              </li>
              <li>
                <code className="bg-background px-1 rounded">/product/[id]</code> - Match
                product pages with dynamic IDs
              </li>
            </ul>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Widget Customization</h2>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-default-500 mb-4">
            Customize the appearance and behavior of your chat widget.
          </p>
          <Button as={Link} href="/widget" variant="bordered" rightIcon={ExternalLink}>
            Go to Widget Customizer
          </Button>
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
