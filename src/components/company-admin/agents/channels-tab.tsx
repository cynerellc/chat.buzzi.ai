"use client";

import { useState } from "react";
import {
  Globe,
  MessageCircle,
  Send,
  Smartphone,
  Instagram,
  Slack,
  MessageSquare,
  Check,
  Settings,
  ExternalLink,
} from "lucide-react";
import { Switch } from "@heroui/react";

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Input,
} from "@/components/ui";

import type { AgentDetail } from "@/hooks/company/useAgents";

interface ChannelsTabProps {
  agent: AgentDetail;
  onSave: (data: Partial<AgentDetail>) => Promise<void>;
  isSaving: boolean;
}

interface ChannelConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  configured: boolean;
  setupRequired: boolean;
  configFields?: {
    key: string;
    label: string;
    type: "text" | "password";
    placeholder: string;
  }[];
}

const defaultChannels: ChannelConfig[] = [
  {
    id: "web",
    name: "Web Widget",
    description: "Embed a chat widget on your website",
    icon: Globe,
    enabled: true,
    configured: true,
    setupRequired: false,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Connect to WhatsApp Business",
    icon: MessageCircle,
    enabled: false,
    configured: false,
    setupRequired: true,
    configFields: [
      { key: "phoneNumber", label: "Phone Number ID", type: "text", placeholder: "Enter your WhatsApp Phone Number ID" },
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "Enter your WhatsApp Access Token" },
    ],
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Connect to Telegram bot",
    icon: Send,
    enabled: false,
    configured: false,
    setupRequired: true,
    configFields: [
      { key: "botToken", label: "Bot Token", type: "password", placeholder: "Enter your Telegram Bot Token" },
    ],
  },
  {
    id: "messenger",
    name: "Facebook Messenger",
    description: "Connect to Facebook Messenger",
    icon: MessageSquare,
    enabled: false,
    configured: false,
    setupRequired: true,
    configFields: [
      { key: "pageId", label: "Page ID", type: "text", placeholder: "Enter your Facebook Page ID" },
      { key: "accessToken", label: "Page Access Token", type: "password", placeholder: "Enter your Page Access Token" },
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Connect to Instagram Direct",
    icon: Instagram,
    enabled: false,
    configured: false,
    setupRequired: true,
    configFields: [
      { key: "accountId", label: "Account ID", type: "text", placeholder: "Enter your Instagram Account ID" },
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "Enter your Access Token" },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Connect to Slack workspace",
    icon: Slack,
    enabled: false,
    configured: false,
    setupRequired: true,
    configFields: [
      { key: "botToken", label: "Bot Token", type: "password", placeholder: "xoxb-..." },
      { key: "signingSecret", label: "Signing Secret", type: "password", placeholder: "Enter your Slack Signing Secret" },
    ],
  },
];

export function ChannelsTab({ agent, onSave, isSaving }: ChannelsTabProps) {
  // Channels configuration is managed locally for now
  // TODO: Add dedicated channels table and API for persistent storage
  const [channels, setChannels] = useState<ChannelConfig[]>(() => defaultChannels);

  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [channelConfigs, setChannelConfigs] = useState<Record<string, Record<string, string>>>({});

  const handleToggleChannel = (channelId: string) => {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === channelId
          ? { ...ch, enabled: !ch.enabled }
          : ch
      )
    );
  };

  const handleConfigChange = (channelId: string, key: string, value: string) => {
    setChannelConfigs((prev) => ({
      ...prev,
      [channelId]: {
        ...prev[channelId],
        [key]: value,
      },
    }));
  };

  const handleSaveChannel = async (channelId: string) => {
    const config = channelConfigs[channelId];
    // In a real implementation, this would validate and save the channel config
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === channelId
          ? { ...ch, configured: true }
          : ch
      )
    );
    setExpandedChannel(null);
  };

  const handleSave = async () => {
    // TODO: Implement channel configuration persistence via dedicated API
    // For now, this is a placeholder that shows the save button but doesn't persist
    // Channels would need their own table: agentChannels with agentId, channelType, enabled, config
    console.log("Channel configuration to save:", channels.map(ch => ({
      id: ch.id,
      enabled: ch.enabled,
      configured: ch.configured,
    })));
  };

  const enabledCount = channels.filter((ch) => ch.enabled).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-default-500">Active Channels</p>
            <p className="text-2xl font-bold">{enabledCount}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-default-500">Available</p>
            <p className="text-2xl font-bold">{channels.length}</p>
          </CardBody>
        </Card>
      </div>

      {/* Channels List */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Communication Channels</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-default-500">
            Enable channels to allow users to interact with this agent through different platforms.
          </p>

          <div className="space-y-3">
            {channels.map((channel) => {
              const Icon = channel.icon;
              const isExpanded = expandedChannel === channel.id;

              return (
                <div key={channel.id} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        channel.enabled ? "bg-primary/10" : "bg-default-100"
                      }`}>
                        <Icon className={`h-5 w-5 ${channel.enabled ? "text-primary" : "text-default-500"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{channel.name}</span>
                          {channel.enabled && channel.configured && (
                            <Badge variant="success">
                              <Check className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          )}
                          {channel.enabled && !channel.configured && channel.setupRequired && (
                            <Badge variant="warning">Setup Required</Badge>
                          )}
                        </div>
                        <p className="text-sm text-default-500">{channel.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {channel.setupRequired && channel.enabled && !channel.configured && (
                        <Button
                          variant="bordered"
                          size="sm"
                          leftIcon={Settings}
                          onPress={() => setExpandedChannel(isExpanded ? null : channel.id)}
                        >
                          Configure
                        </Button>
                      )}
                      <Switch
                        isSelected={channel.enabled}
                        onValueChange={() => handleToggleChannel(channel.id)}
                        isDisabled={channel.setupRequired && !channel.configured && !channel.enabled}
                      />
                    </div>
                  </div>

                  {/* Configuration Panel */}
                  {isExpanded && channel.configFields && (
                    <div className="px-4 pb-4 pt-2 border-t bg-default-50 space-y-4">
                      {channel.configFields.map((field) => (
                        <Input
                          key={field.key}
                          label={field.label}
                          type={field.type}
                          placeholder={field.placeholder}
                          value={channelConfigs[channel.id]?.[field.key] || ""}
                          onValueChange={(value) => handleConfigChange(channel.id, field.key, value)}
                        />
                      ))}
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="bordered"
                          size="sm"
                          onPress={() => setExpandedChannel(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          color="primary"
                          size="sm"
                          onPress={() => handleSaveChannel(channel.id)}
                        >
                          Save Configuration
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Info Note */}
          <div className="p-4 bg-default-50 rounded-lg">
            <p className="text-sm text-default-500">
              <strong>Note:</strong> Some channels require additional setup in their respective platforms.
              Visit the integrations page for detailed setup instructions.
            </p>
            <Button
              variant="light"
              size="sm"
              className="mt-2"
              rightIcon={ExternalLink}
              as="a"
              href="/integrations"
            >
              Go to Integrations
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          color="primary"
          onPress={handleSave}
          isLoading={isSaving}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
