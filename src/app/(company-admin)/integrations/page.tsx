"use client";

import { useState } from "react";
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
  Select,
  Skeleton,
  Switch,
  Tabs,
  type TabItem,
} from "@/components/ui";
import { useSetBreadcrumbs } from "@/contexts/page-context";
import { useDisclosure } from "@/hooks/useDisclosure";
import {
  AlertTriangle,
  Copy,
  MessageSquare,
  Phone,
  Plus,
  Settings2,
  Trash2,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import {
  useIntegrationAccounts,
  useCreateIntegrationAccount,
  useUpdateIntegrationAccount,
  useDeleteIntegrationAccount,
  type IntegrationAccount,
} from "@/hooks/company";

// ============================================================================
// Provider Configuration
// ============================================================================

const providerConfig = {
  whatsapp: {
    name: "WhatsApp Business",
    icon: MessageSquare,
    color: "success" as const,
    description: "Voice calls via WhatsApp Business API",
    fields: [
      { key: "whatsapp_phone_number_id", label: "Phone Number ID", type: "text" },
      { key: "whatsapp_business_account_id", label: "Business Account ID", type: "text" },
      { key: "whatsapp_access_token", label: "Access Token", type: "password" },
      { key: "whatsapp_app_secret", label: "App Secret", type: "password" },
    ],
  },
  twilio: {
    name: "Twilio",
    icon: Phone,
    color: "danger" as const,
    description: "Voice calls via Twilio Programmable Voice",
    fields: [
      { key: "twilio_account_sid", label: "Account SID", type: "text" },
      { key: "twilio_auth_token", label: "Auth Token", type: "password" },
      { key: "twilio_phone_number", label: "Phone Number", type: "text" },
    ],
  },
  vonage: {
    name: "Vonage",
    icon: Phone,
    color: "warning" as const,
    description: "Voice calls via Vonage Voice API",
    fields: [
      { key: "vonage_api_key", label: "API Key", type: "text" },
      { key: "vonage_api_secret", label: "API Secret", type: "password" },
      { key: "vonage_application_id", label: "Application ID", type: "text" },
      { key: "vonage_private_key", label: "Private Key", type: "textarea" },
    ],
  },
  bandwidth: {
    name: "Bandwidth",
    icon: Phone,
    color: "primary" as const,
    description: "Voice calls via Bandwidth Voice API",
    fields: [
      { key: "bandwidth_account_id", label: "Account ID", type: "text" },
      { key: "bandwidth_api_token", label: "API Token", type: "password" },
      { key: "bandwidth_api_secret", label: "API Secret", type: "password" },
    ],
  },
};

type Provider = keyof typeof providerConfig;

// ============================================================================
// Integration Accounts Page
// ============================================================================

export default function IntegrationsPage() {
  useSetBreadcrumbs([{ label: "Integration Accounts" }]);

  const { accounts, isLoading, mutate } = useIntegrationAccounts();
  const { createAccount, isCreating } = useCreateIntegrationAccount();
  const { updateAccount, isUpdating } = useUpdateIntegrationAccount();
  const { deleteAccount, isDeleting } = useDeleteIntegrationAccount();

  const createModal = useDisclosure();
  const deleteModal = useDisclosure();

  const [selectedProvider, setSelectedProvider] = useState<Provider>("whatsapp");
  const [formData, setFormData] = useState<{
    displayName: string;
    phoneNumber: string;
    credentials: Record<string, string>;
  }>({
    displayName: "",
    phoneNumber: "",
    credentials: {},
  });
  const [accountToDelete, setAccountToDelete] = useState<IntegrationAccount | null>(null);

  const handleCreateAccount = async () => {
    try {
      await createAccount({
        provider: selectedProvider,
        displayName: formData.displayName,
        phoneNumber: formData.phoneNumber || undefined,
        credentials: formData.credentials,
      });

      addToast({
        title: "Integration Created",
        description: "Your integration account has been created successfully",
        color: "success",
      });

      createModal.onClose();
      setFormData({ displayName: "", phoneNumber: "", credentials: {} });
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create integration",
        color: "danger",
      });
    }
  };

  const handleToggleActive = async (account: IntegrationAccount) => {
    try {
      await updateAccount({
        accountId: account.id,
        data: { isActive: !account.isActive },
      });

      addToast({
        title: account.isActive ? "Integration Disabled" : "Integration Enabled",
        description: `${account.displayName} has been ${account.isActive ? "disabled" : "enabled"}`,
        color: "success",
      });

      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update integration",
        color: "danger",
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;

    try {
      await deleteAccount({ accountId: accountToDelete.id });

      addToast({
        title: "Integration Deleted",
        description: `${accountToDelete.displayName} has been deleted`,
        color: "success",
      });

      deleteModal.onClose();
      setAccountToDelete(null);
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete integration",
        color: "danger",
      });
    }
  };

  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    addToast({
      title: "Copied",
      description: "Webhook URL copied to clipboard",
      color: "success",
    });
  };

  const openDeleteModal = (account: IntegrationAccount) => {
    setAccountToDelete(account);
    deleteModal.onOpen();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Integration Accounts"
          description="Manage your voice call integrations"
        />
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integration Accounts"
        description="Manage your WhatsApp, Twilio, and Vonage integrations for voice calls"
        actions={
          <Button color="primary" leftIcon={Plus} onClick={createModal.onOpen}>
            Add Integration
          </Button>
        }
      />

      <Tabs
        items={
          [
            {
              key: "all",
              label: `All (${accounts.length})`,
              content: (
                <div className="space-y-4 mt-4">
                  {accounts.length === 0 ? (
                    <Card>
                      <CardBody className="py-12 text-center">
                        <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Integrations</h3>
                        <p className="text-muted-foreground mb-4">
                          Add an integration account to enable voice calls
                        </p>
                        <Button color="primary" leftIcon={Plus} onClick={createModal.onOpen}>
                          Add Integration
                        </Button>
                      </CardBody>
                    </Card>
                  ) : (
                    accounts.map((account) => (
                      <IntegrationAccountCard
                        key={account.id}
                        account={account}
                        onToggle={() => handleToggleActive(account)}
                        onDelete={() => openDeleteModal(account)}
                        onCopyWebhook={copyWebhookUrl}
                        isUpdating={isUpdating}
                      />
                    ))
                  )}
                </div>
              ),
            },
            ...Object.entries(providerConfig).map(([key, config]) => {
              const providerAccounts = accounts.filter((a) => a.provider === key);
              return {
                key,
                label: `${config.name} (${providerAccounts.length})`,
                icon: config.icon,
                content: (
                  <div className="space-y-4 mt-4">
                    {providerAccounts.length === 0 ? (
                      <Card>
                        <CardBody className="py-12 text-center">
                          <config.icon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="text-lg font-semibold mb-2">No {config.name} Integrations</h3>
                          <p className="text-muted-foreground mb-4">
                            Add a {config.name} integration to enable voice calls
                          </p>
                          <Button
                            color="primary"
                            leftIcon={Plus}
                            onClick={() => {
                              setSelectedProvider(key as Provider);
                              createModal.onOpen();
                            }}
                          >
                            Add {config.name}
                          </Button>
                        </CardBody>
                      </Card>
                    ) : (
                      providerAccounts.map((account) => (
                        <IntegrationAccountCard
                          key={account.id}
                          account={account}
                          onToggle={() => handleToggleActive(account)}
                          onDelete={() => openDeleteModal(account)}
                          onCopyWebhook={copyWebhookUrl}
                          isUpdating={isUpdating}
                        />
                      ))
                    )}
                  </div>
                ),
              };
            }),
          ] as TabItem[]
        }
      />

      {/* Create Integration Modal */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.onClose} size="lg">
        <ModalContent>
          <ModalHeader>Add Integration Account</ModalHeader>
          <ModalBody className="space-y-4">
            <Select
              label="Provider"
              options={Object.entries(providerConfig).map(([key, config]) => ({
                value: key,
                label: config.name,
              }))}
              selectedKeys={new Set([selectedProvider])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as Provider;
                if (selected) {
                  setSelectedProvider(selected);
                  setFormData({ displayName: "", phoneNumber: "", credentials: {} });
                }
              }}
            />

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {providerConfig[selectedProvider].description}
              </p>
            </div>

            <Input
              label="Display Name"
              placeholder="My WhatsApp Business"
              value={formData.displayName}
              onValueChange={(value) => setFormData({ ...formData, displayName: value })}
              isRequired
            />

            <Input
              label="Phone Number"
              placeholder="+1234567890"
              value={formData.phoneNumber}
              onValueChange={(value) => setFormData({ ...formData, phoneNumber: value })}
            />

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Credentials</h4>
              {providerConfig[selectedProvider].fields.map((field) => (
                <Input
                  key={field.key}
                  label={field.label}
                  type={field.type === "password" ? "password" : "text"}
                  value={formData.credentials[field.key] || ""}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      credentials: { ...formData.credentials, [field.key]: value },
                    })
                  }
                />
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={createModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isCreating}
              onClick={handleCreateAccount}
              isDisabled={!formData.displayName}
            >
              Create Integration
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.onClose}>
        <ModalContent>
          <ModalHeader className="text-danger">Delete Integration</ModalHeader>
          <ModalBody>
            <div className="flex items-start gap-3 p-3 bg-danger-50 rounded-lg mb-4">
              <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger-700">
                This will permanently delete the integration. Any calls using this
                integration will stop working immediately.
              </p>
            </div>
            <p>
              Are you sure you want to delete <strong>{accountToDelete?.displayName}</strong>?
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={deleteModal.onClose}>
              Cancel
            </Button>
            <Button color="danger" isLoading={isDeleting} onClick={handleDeleteAccount}>
              Delete Integration
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

// ============================================================================
// Integration Account Card Component
// ============================================================================

interface IntegrationAccountCardProps {
  account: IntegrationAccount;
  onToggle: () => void;
  onDelete: () => void;
  onCopyWebhook: (url: string) => void;
  isUpdating: boolean;
}

function IntegrationAccountCard({
  account,
  onToggle,
  onDelete,
  onCopyWebhook,
  isUpdating,
}: IntegrationAccountCardProps) {
  const config = providerConfig[account.provider as Provider];
  const Icon = config?.icon || Phone;
  const webhookUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhook/whatsapp/calls`;

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg bg-${config?.color || "primary"}-50`}>
              <Icon className={`w-6 h-6 text-${config?.color || "primary"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">{account.displayName}</h3>
                <Chip
                  color={account.isActive ? "success" : "default"}
                  size="sm"
                >
                  {account.isActive ? "Active" : "Inactive"}
                </Chip>
                {account.isVerified && (
                  <Chip color="primary" size="sm">
                    <Check className="w-3 h-3 mr-1" />
                    Verified
                  </Chip>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {config?.name || account.provider} • {account.phoneNumber || "No phone number"}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Created {new Date(account.createdAt).toLocaleDateString()}</span>
                <span>•</span>
                <span>Updated {new Date(account.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              isSelected={account.isActive}
              onValueChange={onToggle}
              isDisabled={isUpdating}
              size="sm"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              className="text-danger hover:text-danger"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Webhook URL Section */}
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Webhook URL</span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCopyWebhook(webhookUrl)}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  window.open(
                    "https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/",
                    "_blank"
                  )
                }
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Docs
              </Button>
            </div>
          </div>
          <code className="text-xs text-muted-foreground break-all">{webhookUrl}</code>
        </div>
      </CardBody>
    </Card>
  );
}
