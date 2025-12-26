"use client";

import { useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, AlertTriangle, Shield, Key, Webhook } from "lucide-react";

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Input,
  Select,
  Skeleton,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Switch,
  Textarea,
  addToast,
} from "@/components/ui";
import { useAgent, type AgentDetail } from "@/hooks/company";

interface PageProps {
  params: Promise<{ agentId: string }>;
}

const RETENTION_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "0", label: "Forever" },
];

const RATE_LIMIT_OPTIONS = [
  { value: "10", label: "10 requests/minute" },
  { value: "30", label: "30 requests/minute" },
  { value: "60", label: "60 requests/minute" },
  { value: "120", label: "120 requests/minute" },
  { value: "0", label: "Unlimited" },
];

export default function AgentSettingsPage({ params }: PageProps) {
  const { agentId } = use(params);
  const { agent, isLoading, mutate } = useAgent(agentId);

  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    dataRetentionDays: "30",
    rateLimitPerMinute: "60",
    requireAuthentication: false,
    allowAnonymous: true,
    enableLogging: true,
    enableAnalytics: true,
    webhookUrl: "",
    webhookSecret: "",
    apiKeyRequired: false,
    ipWhitelist: "",
  });

  // Note: Settings are stored in agent.behavior object
  // For advanced settings, a separate settings table could be added

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/company/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      addToast({ title: "Settings saved successfully", color: "success" });
      mutate();
    } catch {
      addToast({ title: "Failed to save settings", color: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/company/agents/${agentId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete agent");

      addToast({ title: "Agent deleted successfully", color: "success" });
      window.location.href = "/agents";
    } catch {
      addToast({ title: "Failed to delete agent", color: "danger" });
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">Agent not found</p>
        <Button asChild variant="outline">
          <Link href="/agents">Back to Agents</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon" aria-label="Back">
              <Link href={`/agents/${agentId}`}>
                <ArrowLeft size={18} />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{agent.name} Settings</h1>
              <p className="text-muted-foreground">Configure advanced settings for this agent</p>
            </div>
          </div>
          <Button color="primary" leftIcon={Save} onPress={handleSave} isLoading={isSaving}>
            Save Settings
          </Button>
        </div>

        {/* Data & Privacy */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Data & Privacy</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-6">
            <Select
              label="Data Retention Period"
              options={RETENTION_OPTIONS}
              selectedKeys={new Set([settings.dataRetentionDays])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                setSettings((prev) => ({ ...prev, dataRetentionDays: selected as string }));
              }}
              description="How long to keep conversation history"
            />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Logging</p>
                <p className="text-sm text-muted-foreground">Log all agent interactions for debugging</p>
              </div>
              <Switch
                isSelected={settings.enableLogging}
                onValueChange={(value) => setSettings((prev) => ({ ...prev, enableLogging: value }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Analytics</p>
                <p className="text-sm text-muted-foreground">Track conversation metrics and performance</p>
              </div>
              <Switch
                isSelected={settings.enableAnalytics}
                onValueChange={(value) => setSettings((prev) => ({ ...prev, enableAnalytics: value }))}
              />
            </div>
          </CardBody>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Security</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-6">
            <Select
              label="Rate Limit"
              options={RATE_LIMIT_OPTIONS}
              selectedKeys={new Set([settings.rateLimitPerMinute])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                setSettings((prev) => ({ ...prev, rateLimitPerMinute: selected as string }));
              }}
              description="Maximum requests per user per minute"
            />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Allow Anonymous Users</p>
                <p className="text-sm text-muted-foreground">Allow users to chat without identification</p>
              </div>
              <Switch
                isSelected={settings.allowAnonymous}
                onValueChange={(value) => setSettings((prev) => ({ ...prev, allowAnonymous: value }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Require API Key</p>
                <p className="text-sm text-muted-foreground">Require API key for widget embedding</p>
              </div>
              <Switch
                isSelected={settings.apiKeyRequired}
                onValueChange={(value) => setSettings((prev) => ({ ...prev, apiKeyRequired: value }))}
              />
            </div>

            <Textarea
              label="IP Whitelist"
              value={settings.ipWhitelist}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, ipWhitelist: value }))}
              placeholder="Enter IP addresses (one per line)"
              description="Leave empty to allow all IPs"
              minRows={3}
            />
          </CardBody>
        </Card>

        {/* Webhooks */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Webhooks</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-6">
            <Input
              label="Webhook URL"
              value={settings.webhookUrl}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, webhookUrl: value }))}
              placeholder="https://your-server.com/webhook"
              description="Receive real-time notifications for agent events"
            />

            <Input
              label="Webhook Secret"
              value={settings.webhookSecret}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, webhookSecret: value }))}
              placeholder="Enter webhook secret"
              description="Used to sign webhook payloads"
              type="password"
            />
          </CardBody>
        </Card>

        {/* Danger Zone */}
        <Card className="border-danger">
          <CardHeader>
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Danger Zone</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Agent</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this agent and all its data. This action cannot be undone.
                </p>
              </div>
              <Button color="danger" variant="outline" leftIcon={Trash2} onPress={() => setShowDeleteModal(true)}>
                Delete Agent
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-danger">
            <AlertTriangle className="h-5 w-5" />
            Delete Agent
          </ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete <strong>{agent.name}</strong>?
            </p>
            <p className="text-sm text-muted-foreground">
              This will permanently delete the agent and all associated conversations, analytics,
              and configuration. This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button color="danger" isLoading={isDeleting} onPress={handleDelete}>
              Delete Agent
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
