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
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Textarea,
  useDisclosure,
} from "@heroui/react";
import {
  AlertTriangle,
  Check,
  CheckCircle,
  ExternalLink,
  Globe,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  Webhook,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layouts/page-header";
import { useCreateWebhook, useIntegrations } from "@/hooks/company";

const webhookEvents = [
  { key: "conversation.created", label: "Conversation Created", description: "When a new conversation starts" },
  { key: "conversation.resolved", label: "Conversation Resolved", description: "When a conversation is resolved" },
  { key: "conversation.escalated", label: "Conversation Escalated", description: "When escalated to human" },
  { key: "message.created", label: "Message Created", description: "When a new message is sent" },
  { key: "feedback.received", label: "Feedback Received", description: "When customer gives feedback" },
];

const availableIntegrations = [
  {
    type: "slack",
    name: "Slack",
    description: "Send notifications and alerts to Slack channels",
    icon: "🔔",
    color: "bg-purple-100",
    available: true,
  },
  {
    type: "hubspot",
    name: "HubSpot",
    description: "Sync conversations and contacts with HubSpot CRM",
    icon: "🧡",
    color: "bg-orange-100",
    available: false,
  },
  {
    type: "salesforce",
    name: "Salesforce",
    description: "Integrate with Salesforce CRM",
    icon: "☁️",
    color: "bg-blue-100",
    available: false,
  },
  {
    type: "zapier",
    name: "Zapier",
    description: "Connect to 5000+ apps through Zapier",
    icon: "⚡",
    color: "bg-yellow-100",
    available: false,
  },
  {
    type: "zendesk",
    name: "Zendesk",
    description: "Escalate tickets to Zendesk Support",
    icon: "🎫",
    color: "bg-green-100",
    available: false,
  },
  {
    type: "intercom",
    name: "Intercom",
    description: "Sync with Intercom customer platform",
    icon: "💬",
    color: "bg-cyan-100",
    available: false,
  },
];

const statusColors: Record<string, "success" | "warning" | "danger" | "default"> = {
  active: "success",
  inactive: "default",
  error: "danger",
};

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

export default function IntegrationsPage() {
  const { integrations, webhooks, isLoading, mutate } = useIntegrations();
  const { createWebhook, isCreating } = useCreateWebhook();

  const webhookModal = useDisclosure();

  const [webhookForm, setWebhookForm] = useState({
    name: "",
    description: "",
    url: "",
    events: [] as string[],
    secret: "",
  });

  const handleCreateWebhook = async () => {
    if (!webhookForm.name || !webhookForm.url || webhookForm.events.length === 0) {
      addToast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        color: "danger",
      });
      return;
    }

    try {
      await createWebhook({
        name: webhookForm.name,
        url: webhookForm.url,
        events: webhookForm.events,
        description: webhookForm.description || undefined,
        secret: webhookForm.secret || undefined,
      });
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
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Integrations" description="Connect your tools and services" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect your tools and services"
        actions={
          <Button
            color="primary"
            startContent={<Plus className="w-4 h-4" />}
            onPress={webhookModal.onOpen}
          >
            Add Webhook
          </Button>
        }
      />

      {/* Connected Integrations */}
      {integrations.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Connected Integrations</h3>
          </CardHeader>
          <CardBody>
            <Table aria-label="Connected integrations" removeWrapper>
              <TableHeader>
                <TableColumn>INTEGRATION</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>LAST ACTIVITY</TableColumn>
                <TableColumn width={100}>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {integrations.map((integration) => (
                  <TableRow key={integration.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{integration.name}</p>
                        <p className="text-sm text-default-500">{integration.type}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" color={statusColors[integration.status]} variant="flat">
                        {integration.status}
                      </Chip>
                      {integration.lastError && (
                        <p className="text-xs text-danger mt-1">{integration.lastError}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-default-500">
                        {formatDate(integration.updatedAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button isIconOnly size="sm" variant="light">
                          <Settings2 className="w-4 h-4" />
                        </Button>
                        <Button isIconOnly size="sm" variant="light" color="danger">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}

      {/* Webhooks */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Webhooks</h3>
            <p className="text-sm text-default-500">Send real-time data to external services</p>
          </div>
        </CardHeader>
        <CardBody>
          {webhooks.length > 0 ? (
            <Table aria-label="Webhooks" removeWrapper>
              <TableHeader>
                <TableColumn>NAME</TableColumn>
                <TableColumn>ENDPOINT</TableColumn>
                <TableColumn>EVENTS</TableColumn>
                <TableColumn>STATS</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn width={100}>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{webhook.name}</p>
                        {webhook.description && (
                          <p className="text-xs text-default-500">{webhook.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-default-100 px-2 py-1 rounded">
                        {webhook.url.length > 40 ? `${webhook.url.substring(0, 40)}...` : webhook.url}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.slice(0, 2).map((event) => (
                          <Chip key={event} size="sm" variant="flat">
                            {event.split(".")[1]}
                          </Chip>
                        ))}
                        {webhook.events.length > 2 && (
                          <Chip size="sm" variant="flat">
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
                      <Switch size="sm" isSelected={webhook.isActive} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button isIconOnly size="sm" variant="light" title="Test webhook">
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button isIconOnly size="sm" variant="light" color="danger">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Webhook className="w-12 h-12 mx-auto mb-3 text-default-300" />
              <p className="text-default-500 mb-4">No webhooks configured</p>
              <Button
                color="primary"
                variant="flat"
                startContent={<Plus className="w-4 h-4" />}
                onPress={webhookModal.onOpen}
              >
                Create Webhook
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Available Integrations */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Available Integrations</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableIntegrations.map((integration) => (
              <Card key={integration.type} className="border border-default-200">
                <CardBody className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`text-2xl p-2 rounded-lg ${integration.color}`}>
                      {integration.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{integration.name}</h4>
                        {!integration.available && (
                          <Chip size="sm" variant="flat">Coming Soon</Chip>
                        )}
                      </div>
                      <p className="text-sm text-default-500 mt-1">{integration.description}</p>
                      <Button
                        size="sm"
                        className="mt-3"
                        color={integration.available ? "primary" : "default"}
                        variant={integration.available ? "flat" : "flat"}
                        isDisabled={!integration.available}
                        startContent={
                          integration.available ? (
                            <Plus className="w-3 h-3" />
                          ) : null
                        }
                      >
                        {integration.available ? "Connect" : "Coming Soon"}
                      </Button>
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
              <p className="text-sm text-default-500 mb-3">
                Build custom integrations using our REST API. Access conversations, messages,
                and more programmatically.
              </p>
              <Button
                variant="flat"
                size="sm"
                endContent={<ExternalLink className="w-3 h-3" />}
              >
                View API Documentation
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Create Webhook Modal */}
      <Modal isOpen={webhookModal.isOpen} onClose={webhookModal.onClose} size="lg">
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
                startContent={<Globe className="w-4 h-4 text-default-400" />}
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
                        <p className="text-xs text-default-500">{event.description}</p>
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
            <Button variant="light" onPress={webhookModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isCreating}
              isDisabled={!webhookForm.name || !webhookForm.url || webhookForm.events.length === 0}
              onPress={handleCreateWebhook}
            >
              Create Webhook
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
