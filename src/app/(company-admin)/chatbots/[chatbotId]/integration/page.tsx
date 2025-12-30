"use client";

import {
  addToast,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Skeleton,
  Switch,
  TableRoot,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  Separator,
} from "@/components/ui";
import { useDisclosure } from "@/hooks/useDisclosure";
import {
  CheckCircle,
  Copy,
  ExternalLink,
  Globe,
  MessageCircle,
  Instagram,
  Facebook,
  Palette,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  Webhook,
  XCircle,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import { useState, useCallback } from "react";
import useSWR from "swr";

import { useChatbotContext } from "../chatbot-context";

const webhookEvents = [
  { key: "conversation.created", label: "Conversation Created", description: "When a new conversation starts" },
  { key: "conversation.resolved", label: "Conversation Resolved", description: "When a conversation is resolved" },
  { key: "conversation.escalated", label: "Conversation Escalated", description: "When escalated to human" },
  { key: "message.created", label: "Message Created", description: "When a new message is sent" },
  { key: "feedback.received", label: "Feedback Received", description: "When customer gives feedback" },
];

// Channel definitions
const channelDefinitions = [
  {
    type: "web",
    name: "Web Widget",
    description: "Embed chat widget on your website",
    icon: Globe,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    hasWidgetCustomization: true,
  },
  {
    type: "whatsapp",
    name: "WhatsApp",
    description: "Connect with customers on WhatsApp Business",
    icon: MessageCircle,
    iconColor: "text-green-500",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    credentialFields: [
      { field: "businessAccountId", label: "Business Account ID", type: "text", required: true, placeholder: "Enter your WhatsApp Business Account ID" },
      { field: "accessToken", label: "Access Token", type: "password", required: true, placeholder: "Enter your permanent access token" },
      { field: "phoneNumberId", label: "Phone Number ID", type: "text", required: true, placeholder: "Enter your Phone Number ID" },
      { field: "verifyToken", label: "Verify Token", type: "text", required: false, placeholder: "Custom verify token (auto-generated if empty)" },
    ],
  },
  {
    type: "messenger",
    name: "Facebook Messenger",
    description: "Engage customers through Facebook Messenger",
    icon: Facebook,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    credentialFields: [
      { field: "appId", label: "App ID", type: "text", required: true, placeholder: "Enter your Facebook App ID" },
      { field: "pageId", label: "Page ID", type: "text", required: true, placeholder: "Enter your Facebook Page ID" },
      { field: "pageAccessToken", label: "Page Access Token", type: "password", required: true, placeholder: "Enter your Page Access Token" },
      { field: "verifyToken", label: "Verify Token", type: "text", required: false, placeholder: "Custom verify token (auto-generated if empty)" },
    ],
  },
  {
    type: "instagram",
    name: "Instagram",
    description: "Respond to Instagram Direct Messages",
    icon: Instagram,
    iconColor: "text-pink-500",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
    credentialFields: [
      { field: "appId", label: "App ID", type: "text", required: true, placeholder: "Enter your Facebook App ID" },
      { field: "instagramAccountId", label: "Instagram Account ID", type: "text", required: true, placeholder: "Enter your Instagram Business Account ID" },
      { field: "accessToken", label: "Access Token", type: "password", required: true, placeholder: "Enter your access token" },
    ],
  },
];

// Coming soon integrations
const comingSoonIntegrations = [
  {
    type: "slack",
    name: "Slack",
    description: "Send notifications and alerts to Slack channels",
    icon: "S",
    color: "bg-purple-100 dark:bg-purple-900/30",
    textColor: "text-purple-600",
  },
  {
    type: "hubspot",
    name: "HubSpot",
    description: "Sync conversations and contacts with HubSpot CRM",
    icon: "H",
    color: "bg-orange-100 dark:bg-orange-900/30",
    textColor: "text-orange-600",
  },
  {
    type: "salesforce",
    name: "Salesforce",
    description: "Integrate with Salesforce CRM",
    icon: "SF",
    color: "bg-blue-100 dark:bg-blue-900/30",
    textColor: "text-blue-600",
  },
  {
    type: "zendesk",
    name: "Zendesk",
    description: "Escalate tickets to Zendesk Support",
    icon: "Z",
    color: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-600",
  },
];

interface ChannelConfig {
  id: string;
  channel: string;
  isActive: boolean;
  webhookUrl: string | null;
  credentials: Record<string, string>;
  settings: Record<string, unknown>;
  lastConnectedAt: string | null;
  lastError: string | null;
}

interface WebhookItem {
  id: string;
  name: string;
  description: string | null;
  url: string;
  events: string[];
  isActive: boolean;
  successfulDeliveries: number;
  failedDeliveries: number;
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return { channels: [], webhooks: [] };
    throw new Error("Failed to fetch");
  }
  return res.json();
};

export default function ChatbotIntegrationPage() {
  const { chatbotId, chatbot } = useChatbotContext();

  const { data, isLoading, mutate } = useSWR<{ channels: ChannelConfig[]; webhooks: WebhookItem[] }>(
    `/api/company/chatbots/${chatbotId}/integrations`,
    fetcher,
    { fallbackData: { channels: [], webhooks: [] } }
  );

  const channels = data?.channels ?? [];
  const webhooks = data?.webhooks ?? [];

  const webhookModal = useDisclosure();
  const channelSettingsModal = useDisclosure();

  const [isCreating, setIsCreating] = useState(false);
  const [togglingChannel, setTogglingChannel] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<typeof channelDefinitions[0] | null>(null);
  const [channelCredentials, setChannelCredentials] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const [webhookForm, setWebhookForm] = useState({
    name: "",
    description: "",
    url: "",
    events: [] as string[],
    secret: "",
  });

  // Get channel status
  const getChannelConfig = useCallback((channelType: string) => {
    return channels.find((c) => c.channel === channelType);
  }, [channels]);

  const isChannelEnabled = useCallback((channelType: string) => {
    const config = getChannelConfig(channelType);
    return config?.isActive ?? false;
  }, [getChannelConfig]);

  // Toggle channel
  const handleToggleChannel = async (channelType: string, enabled: boolean) => {
    setTogglingChannel(channelType);
    try {
      const response = await fetch(
        `/api/company/chatbots/${chatbotId}/integrations/channels`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: channelType,
            isActive: enabled,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to update channel");

      addToast({
        title: enabled ? "Channel Enabled" : "Channel Disabled",
        description: `${channelType} channel has been ${enabled ? "enabled" : "disabled"}`,
        color: "success",
      });
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update channel",
        color: "danger",
      });
    } finally {
      setTogglingChannel(null);
    }
  };

  // Open channel settings
  const handleOpenChannelSettings = (channel: typeof channelDefinitions[0]) => {
    const config = getChannelConfig(channel.type);
    setSelectedChannel(channel);
    setChannelCredentials(config?.credentials || {});
    setShowSecrets({});
    channelSettingsModal.onOpen();
  };

  // Save channel settings
  const handleSaveChannelSettings = async () => {
    if (!selectedChannel) return;

    setSavingSettings(true);
    try {
      const response = await fetch(
        `/api/company/chatbots/${chatbotId}/integrations/channels`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: selectedChannel.type,
            credentials: channelCredentials,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to save settings");

      addToast({
        title: "Settings Saved",
        description: `${selectedChannel.name} settings have been updated`,
        color: "success",
      });
      channelSettingsModal.onClose();
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        color: "danger",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast({
      title: "Copied",
      description: `${label} copied to clipboard`,
      color: "success",
    });
  };

  const handleCreateWebhook = async () => {
    if (!webhookForm.name || !webhookForm.url || webhookForm.events.length === 0) {
      addToast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        color: "danger",
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(
        `/api/company/chatbots/${chatbotId}/integrations/webhooks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: webhookForm.name,
            url: webhookForm.url,
            events: webhookForm.events,
            description: webhookForm.description || undefined,
            secret: webhookForm.secret || undefined,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to create webhook");

      addToast({
        title: "Webhook Created",
        description: "Your webhook has been created successfully",
        color: "success",
      });
      setWebhookForm({ name: "", description: "", url: "", events: [], secret: "" });
      webhookModal.onClose();
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create webhook",
        color: "danger",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Integration</h2>
          <p className="text-sm text-muted-foreground">Connect your tools and services</p>
        </div>
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Integration</h2>
          <p className="text-sm text-muted-foreground">
            Configure channels and integrations for {chatbot?.name}
          </p>
        </div>
      </div>

      {/* Channels Section */}
      <Card>
        <CardHeader>
          <div>
            <h3 className="text-lg font-semibold">Channels</h3>
            <p className="text-sm text-muted-foreground">
              Enable channels to receive messages from different platforms
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channelDefinitions.map((channel) => {
              const config = getChannelConfig(channel.type);
              const isEnabled = isChannelEnabled(channel.type);
              const isToggling = togglingChannel === channel.type;
              const Icon = channel.icon;

              return (
                <Card key={channel.type} className="border border-default-200">
                  <CardBody className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${channel.bgColor}`}>
                          <Icon className={`w-5 h-5 ${channel.iconColor}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{channel.name}</h4>
                            {isEnabled && (
                              <Chip color="success" size="sm">Active</Chip>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {channel.description}
                          </p>
                          {config?.lastConnectedAt && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Last active: {formatDate(config.lastConnectedAt)}
                            </p>
                          )}
                          {config?.lastError && (
                            <p className="text-xs text-danger mt-1">
                              Error: {config.lastError}
                            </p>
                          )}
                        </div>
                      </div>
                      <Switch
                        isSelected={isEnabled}
                        isDisabled={isToggling}
                        onValueChange={(checked) => handleToggleChannel(channel.type, checked)}
                      />
                    </div>

                    {/* Channel-specific actions when enabled */}
                    {isEnabled && (
                      <div className="mt-4 pt-4 border-t border-default-200 flex gap-2">
                        {channel.hasWidgetCustomization ? (
                          <Link href={`/chatbots/${chatbotId}/widget`}>
                            <Button
                              size="sm"
                              variant="secondary"
                              leftIcon={Palette}
                            >
                              Widget Customization
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            leftIcon={Settings2}
                            onPress={() => handleOpenChannelSettings(channel)}
                          >
                            Settings
                          </Button>
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Coming Soon Integrations */}
      <Card>
        <CardHeader>
          <div>
            <h3 className="text-lg font-semibold">Coming Soon</h3>
            <p className="text-sm text-muted-foreground">
              More integrations are on the way
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {comingSoonIntegrations.map((integration) => (
              <Card key={integration.type} className="border border-default-200">
                <CardBody className="p-4">
                  <div className="flex flex-col items-center text-center">
                    <div className={`w-12 h-12 rounded-lg ${integration.color} flex items-center justify-center mb-3`}>
                      <span className={`text-lg font-bold ${integration.textColor}`}>
                        {integration.icon}
                      </span>
                    </div>
                    <h4 className="font-medium">{integration.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {integration.description}
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">Coming Soon</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* API Information */}
      <Card>
        <CardBody className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium mb-1">Custom Integrations via API</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Build custom integrations using our REST API. Access conversations, messages,
                and more programmatically.
              </p>
              <Button
                variant="secondary"
                size="sm"
              >
                View API Documentation
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Webhooks Section */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Webhooks</h3>
            <p className="text-sm text-muted-foreground">Send real-time data to external services</p>
          </div>
          <Button
            color="primary"
            size="sm"
            leftIcon={Plus}
            onPress={webhookModal.onOpen}
          >
            Add Webhook
          </Button>
        </CardHeader>
        <CardBody>
          {webhooks.length > 0 ? (
            <TableRoot>
              <TableHeader>
                <TableRow>
                  <TableHead>NAME</TableHead>
                  <TableHead>ENDPOINT</TableHead>
                  <TableHead>EVENTS</TableHead>
                  <TableHead>STATS</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead className="w-24">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{webhook.name}</p>
                        {webhook.description && (
                          <p className="text-xs text-muted-foreground">{webhook.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {webhook.url.length > 40 ? `${webhook.url.substring(0, 40)}...` : webhook.url}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.slice(0, 2).map((event) => (
                          <Chip key={event} size="sm">
                            {event.split(".")[1]}
                          </Chip>
                        ))}
                        {webhook.events.length > 2 && (
                          <Chip size="sm">
                            +{webhook.events.length - 2}
                          </Chip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle className="w-3 h-3" />
                          {webhook.successfulDeliveries}
                        </span>
                        <span className="flex items-center gap-1 text-danger">
                          <XCircle className="w-3 h-3" />
                          {webhook.failedDeliveries}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch isSelected={webhook.isActive} size="sm" />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="Test webhook">
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableRoot>
          ) : (
            <div className="text-center py-8">
              <Webhook className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-4">No webhooks configured</p>
              <Button
                variant="secondary"
                onClick={webhookModal.onOpen}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Webhook
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Create Webhook Modal */}
      <Modal isOpen={webhookModal.isOpen} onClose={webhookModal.onClose}>
        <ModalContent>
          <ModalHeader>Create Webhook</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Name"
                placeholder="My Webhook"
                value={webhookForm.name}
                onValueChange={(value) => setWebhookForm((prev) => ({ ...prev, name: value }))}
                isRequired
              />
              <Textarea
                label="Description"
                placeholder="Optional description"
                value={webhookForm.description}
                onValueChange={(value) =>
                  setWebhookForm((prev) => ({ ...prev, description: value }))
                }
              />
              <Input
                label="Endpoint URL"
                placeholder="https://api.example.com/webhook"
                value={webhookForm.url}
                onValueChange={(value) => setWebhookForm((prev) => ({ ...prev, url: value }))}
                isRequired
                startContent={<Globe className="w-4 h-4 text-muted-foreground" />}
              />
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Events to Subscribe <span className="text-danger">*</span>
                </label>
                <div className="space-y-2">
                  {webhookEvents.map((event) => (
                    <div
                      key={event.key}
                      className="flex items-center justify-between p-3 border border-default-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm">{event.label}</p>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      </div>
                      <Switch
                        size="sm"
                        isSelected={webhookForm.events.includes(event.key)}
                        onValueChange={(checked) => {
                          setWebhookForm((prev) => ({
                            ...prev,
                            events: checked
                              ? [...prev.events, event.key]
                              : prev.events.filter((e) => e !== event.key),
                          }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <Input
                label="Secret (Optional)"
                placeholder="Used to verify webhook signatures"
                value={webhookForm.secret}
                onValueChange={(value) => setWebhookForm((prev) => ({ ...prev, secret: value }))}
                description="We'll include this in the X-Webhook-Signature header"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={webhookModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isCreating}
              disabled={!webhookForm.name || !webhookForm.url || webhookForm.events.length === 0}
              onPress={handleCreateWebhook}
            >
              Create Webhook
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Channel Settings Modal */}
      <Modal isOpen={channelSettingsModal.isOpen} onClose={channelSettingsModal.onClose} size="lg">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-3">
              {selectedChannel && (
                <>
                  <div className={`p-2 rounded-lg ${selectedChannel.bgColor}`}>
                    <selectedChannel.icon className={`w-5 h-5 ${selectedChannel.iconColor}`} />
                  </div>
                  <div>
                    <h3>{selectedChannel.name} Settings</h3>
                    <p className="text-sm text-muted-foreground font-normal">
                      Configure your {selectedChannel.name} integration
                    </p>
                  </div>
                </>
              )}
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedChannel && (
              <div className="space-y-6">
                {/* Webhook URL Section */}
                {getChannelConfig(selectedChannel.type)?.webhookUrl && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Webhook URL</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Add this URL to your {selectedChannel.name} developer settings to receive messages
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={getChannelConfig(selectedChannel.type)?.webhookUrl || ""}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        size="icon"
                        variant="secondary"
                        onPress={() => copyToClipboard(
                          getChannelConfig(selectedChannel.type)?.webhookUrl || "",
                          "Webhook URL"
                        )}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Credential Fields */}
                <div className="space-y-4">
                  <h4 className="font-medium">API Credentials</h4>
                  <p className="text-sm text-muted-foreground">
                    Enter your {selectedChannel.name} API credentials. These are securely stored and encrypted.
                  </p>

                  {selectedChannel.credentialFields?.map((field) => (
                    <div key={field.field}>
                      <Input
                        label={field.label}
                        placeholder={field.placeholder}
                        type={field.type === "password" && !showSecrets[field.field] ? "password" : "text"}
                        value={channelCredentials[field.field] || ""}
                        onValueChange={(value) => setChannelCredentials((prev) => ({ ...prev, [field.field]: value }))}
                        isRequired={field.required}
                        endContent={
                          field.type === "password" && (
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => setShowSecrets((prev) => ({ ...prev, [field.field]: !prev[field.field] }))}
                            >
                              {showSecrets[field.field] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          )
                        }
                      />
                    </div>
                  ))}
                </div>

                {/* Help text */}
                <div className="p-4 bg-muted rounded-lg">
                  <h5 className="font-medium text-sm mb-2">Need help?</h5>
                  <p className="text-xs text-muted-foreground">
                    {selectedChannel.type === "whatsapp" && (
                      <>
                        Visit the <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">WhatsApp Business Cloud API documentation</a> to learn how to set up your integration.
                      </>
                    )}
                    {selectedChannel.type === "messenger" && (
                      <>
                        Visit the <a href="https://developers.facebook.com/docs/messenger-platform/getting-started" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Messenger Platform documentation</a> to learn how to set up your integration.
                      </>
                    )}
                    {selectedChannel.type === "instagram" && (
                      <>
                        Visit the <a href="https://developers.facebook.com/docs/instagram-api/getting-started" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Instagram API documentation</a> to learn how to set up your integration.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={channelSettingsModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={savingSettings}
              onPress={handleSaveChannelSettings}
            >
              Save Settings
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
