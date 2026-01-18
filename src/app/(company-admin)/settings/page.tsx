"use client";

import {
  addToast,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Separator,
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
  Textarea,
} from "@/components/ui";
import { useSetBreadcrumbs } from "@/contexts/page-context";
import { useDisclosure } from "@/hooks/useDisclosure";
import {
  AlertTriangle,
  Bell,
  Building2,
  Check,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Key,
  Laptop,
  Monitor,
  Palette,
  RefreshCw,
  Shield,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layouts/page-header";
import {
  useGenerateApiKey,
  useRevokeApiKey,
  useSettings,
  useUpdateSettings,
} from "@/hooks/company";
import { useSessions, useRevokeSession, useRevokeAllSessions } from "@/hooks/auth";

const timezones = [
  { key: "UTC", label: "UTC (Coordinated Universal Time)" },
  { key: "America/New_York", label: "Eastern Time (US & Canada)" },
  { key: "America/Chicago", label: "Central Time (US & Canada)" },
  { key: "America/Denver", label: "Mountain Time (US & Canada)" },
  { key: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
  { key: "Europe/London", label: "London" },
  { key: "Europe/Paris", label: "Paris, Berlin" },
  { key: "Asia/Tokyo", label: "Tokyo" },
  { key: "Asia/Singapore", label: "Singapore" },
  { key: "Australia/Sydney", label: "Sydney" },
];

const locales = [
  { key: "en", label: "English" },
  { key: "es", label: "Spanish" },
  { key: "fr", label: "French" },
  { key: "de", label: "German" },
  { key: "pt", label: "Portuguese" },
  { key: "ja", label: "Japanese" },
  { key: "zh", label: "Chinese" },
];

export default function SettingsPage() {
  useSetBreadcrumbs([{ label: "Settings" }]);
  const { settings, isLoading, mutate } = useSettings();
  const { updateSettings, isUpdating } = useUpdateSettings();
  const { generateKey, isGenerating } = useGenerateApiKey();
  const { revokeKey, isRevoking } = useRevokeApiKey();
  const { sessions, isLoading: sessionsLoading, mutate: mutateSessions } = useSessions();
  const { revokeSession, isRevoking: isRevokingSession } = useRevokeSession();
  const { revokeAllSessions, isRevoking: isRevokingAll } = useRevokeAllSessions();

  const apiKeyModal = useDisclosure();
  const revokeAllSessionsModal = useDisclosure();
  const revokeModal = useDisclosure();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    timezone: "UTC",
    locale: "en",
    logoUrl: "",
    primaryColor: "#6437F3",
    secondaryColor: "#2b3dd8",
    customDomain: "",
    notificationSettings: {
      emailNotifications: true,
      escalationAlerts: true,
      dailyDigest: false,
      weeklyReport: true,
    },
    securitySettings: {
      requireTwoFactor: false,
      sessionTimeout: 60,
      ipWhitelist: [] as string[],
      allowPublicApi: false,
    },
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [ipInput, setIpInput] = useState("");
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  const handleRevokeDeviceSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      await revokeSession(sessionId);
      addToast({
        title: "Session Revoked",
        description: "The device has been signed out",
        color: "success",
      });
      mutateSessions();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revoke session",
        color: "danger",
      });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllDeviceSessions = async () => {
    try {
      await revokeAllSessions();
      addToast({
        title: "All Sessions Revoked",
        description: "All other devices have been signed out",
        color: "success",
      });
      revokeAllSessionsModal.onClose();
      mutateSessions();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revoke sessions",
        color: "danger",
      });
    }
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="w-5 h-5" />;
      case "tablet":
        return <Tablet className="w-5 h-5" />;
      default:
        return <Monitor className="w-5 h-5" />;
    }
  };

  // Sync form with settings
  useEffect(() => {
    if (settings) {
       
      setFormData({
        name: settings.name,
        description: settings.description || "",
        timezone: settings.timezone,
        locale: settings.locale,
        logoUrl: settings.logoUrl || "",
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        customDomain: settings.customDomain || "",
        notificationSettings: settings.notificationSettings,
        securitySettings: settings.securitySettings,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings(formData);
      addToast({
        title: "Settings Saved",
        description: "Your settings have been updated successfully",
        color: "success",
      });
      setHasChanges(false);
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        color: "danger",
      });
    }
  };

  const handleGenerateApiKey = async () => {
    try {
      const result = await generateKey();
      setNewApiKey(result.apiKey);
      addToast({
        title: "API Key Generated",
        description: "Save your API key now - it won't be shown again",
        color: "warning",
      });
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate API key",
        color: "danger",
      });
    }
  };

  const handleRevokeApiKey = async () => {
    try {
      await revokeKey();
      addToast({
        title: "API Key Revoked",
        description: "Your API key has been revoked",
        color: "success",
      });
      revokeModal.onClose();
      mutate();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revoke API key",
        color: "danger",
      });
    }
  };

  const copyApiKey = () => {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      addToast({
        title: "Copied",
        description: "API key copied to clipboard",
        color: "success",
      });
    }
  };

  const updateFormField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const updateNotificationSetting = (key: string, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      notificationSettings: { ...prev.notificationSettings, [key]: value },
    }));
    setHasChanges(true);
  };

  const updateSecuritySetting = (key: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      securitySettings: { ...prev.securitySettings, [key]: value },
    }));
    setHasChanges(true);
  };

  const addIpToWhitelist = () => {
    if (ipInput && !formData.securitySettings.ipWhitelist.includes(ipInput)) {
      updateSecuritySetting("ipWhitelist", [...formData.securitySettings.ipWhitelist, ipInput]);
      setIpInput("");
    }
  };

  const removeIpFromWhitelist = (ip: string) => {
    updateSecuritySetting(
      "ipWhitelist",
      formData.securitySettings.ipWhitelist.filter((i) => i !== ip)
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" description="Manage your company settings" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your company settings"
        actions={
          hasChanges && (
            <Button color="primary" isLoading={isUpdating} onClick={handleSave}>
              Save Changes
            </Button>
          )
        }
      />

      <Tabs
        items={[
          {
            key: "general",
            label: "General",
            icon: Building2,
            content: (
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">Company Information</h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <Input
                    label="Company Name"
                    value={formData.name}
                    onValueChange={(value) => updateFormField("name", value)}
                    isRequired
                  />
                  <Textarea
                    label="Description"
                    value={formData.description}
                    onValueChange={(value) => updateFormField("description", value)}
                    minRows={3}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Timezone"
                      options={timezones.map((tz) => ({ value: tz.key, label: tz.label }))}
                      selectedKeys={new Set([formData.timezone])}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0];
                        if (selected) updateFormField("timezone", selected as string);
                      }}
                    />
                    <Select
                      label="Language"
                      options={locales.map((l) => ({ value: l.key, label: l.label }))}
                      selectedKeys={new Set([formData.locale])}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0];
                        if (selected) updateFormField("locale", selected as string);
                      }}
                    />
                  </div>
                </CardBody>
              </Card>
            ),
          },
          {
            key: "branding",
            label: "Branding",
            icon: Palette,
            content: (
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">Brand Settings</h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <Input
                    label="Logo URL"
                    value={formData.logoUrl}
                    onValueChange={(value) => updateFormField("logoUrl", value)}
                    placeholder="https://..."
                    description="URL to your company logo"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      type="color"
                      label="Primary Color"
                      value={formData.primaryColor}
                      onValueChange={(value) => updateFormField("primaryColor", value)}
                      className="h-10"
                    />
                    <Input
                      type="color"
                      label="Secondary Color"
                      value={formData.secondaryColor}
                      onValueChange={(value) => updateFormField("secondaryColor", value)}
                      className="h-10"
                    />
                  </div>
                  <Separator />
                  <Input
                    label="Custom Domain"
                    value={formData.customDomain}
                    onValueChange={(value) => updateFormField("customDomain", value)}
                    placeholder="support.yourcompany.com"
                    startContent={<Globe className="w-4 h-4 text-muted-foreground" />}
                    description="Custom domain for your support portal"
                  />
                </CardBody>
              </Card>
            ),
          },
          {
            key: "notifications",
            label: "Notifications",
            icon: Bell,
            content: (
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">Notification Preferences</h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-default-200 rounded-lg">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Switch
                      isSelected={formData.notificationSettings.emailNotifications}
                      onValueChange={(value) => updateNotificationSetting("emailNotifications", value)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 border border-default-200 rounded-lg">
                    <div>
                      <p className="font-medium">Escalation Alerts</p>
                      <p className="text-sm text-muted-foreground">Get notified when conversations are escalated</p>
                    </div>
                    <Switch
                      isSelected={formData.notificationSettings.escalationAlerts}
                      onValueChange={(value) => updateNotificationSetting("escalationAlerts", value)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 border border-default-200 rounded-lg">
                    <div>
                      <p className="font-medium">Daily Digest</p>
                      <p className="text-sm text-muted-foreground">Receive a daily summary of activity</p>
                    </div>
                    <Switch
                      isSelected={formData.notificationSettings.dailyDigest}
                      onValueChange={(value) => updateNotificationSetting("dailyDigest", value)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 border border-default-200 rounded-lg">
                    <div>
                      <p className="font-medium">Weekly Report</p>
                      <p className="text-sm text-muted-foreground">Receive weekly analytics reports</p>
                    </div>
                    <Switch
                      isSelected={formData.notificationSettings.weeklyReport}
                      onValueChange={(value) => updateNotificationSetting("weeklyReport", value)}
                    />
                  </div>
                </CardBody>
              </Card>
            ),
          },
          {
            key: "security",
            label: "Security",
            icon: Shield,
            content: (
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">Security Settings</h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-default-200 rounded-lg">
                    <div>
                      <p className="font-medium">Require Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">Require 2FA for all team members</p>
                    </div>
                    <Switch
                      isSelected={formData.securitySettings.requireTwoFactor}
                      onValueChange={(value) => updateSecuritySetting("requireTwoFactor", value)}
                    />
                  </div>
                  <Input
                    type="number"
                    label="Session Timeout (minutes)"
                    value={String(formData.securitySettings.sessionTimeout)}
                    onValueChange={(value) => updateSecuritySetting("sessionTimeout", parseInt(value) || 60)}
                    min={5}
                    max={480}
                    description="Automatically log out after inactivity"
                  />
                  <Separator />
                  <div>
                    <label className="text-sm font-medium mb-2 block">IP Whitelist</label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Restrict access to specific IP addresses
                    </p>
                    <div className="flex gap-2 mb-3">
                      <Input
                        placeholder="Enter IP address"
                        value={ipInput}
                        onValueChange={setIpInput}
                        className="flex-1"
                      />
                      <Button onClick={addIpToWhitelist}>Add</Button>
                    </div>
                    {formData.securitySettings.ipWhitelist.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.securitySettings.ipWhitelist.map((ip) => (
                          <Chip key={ip} onClose={() => removeIpFromWhitelist(ip)}>
                            {ip}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between p-4 border border-default-200 rounded-lg">
                    <div>
                      <p className="font-medium">Allow Public API Access</p>
                      <p className="text-sm text-muted-foreground">Enable API access with API key authentication</p>
                    </div>
                    <Switch
                      isSelected={formData.securitySettings.allowPublicApi}
                      onValueChange={(value) => updateSecuritySetting("allowPublicApi", value)}
                    />
                  </div>
                </CardBody>
              </Card>
            ),
          },
          {
            key: "api",
            title: (
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                API
              </div>
            ),
            content: (
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">API Access</h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Use API keys to authenticate requests to the Buzzi API.
                  </p>
                  {settings?.hasApiKey ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 p-4 bg-success-50 rounded-lg">
                        <Check className="w-5 h-5 text-success" />
                        <span className="text-sm text-success-700">API key is configured</span>
                      </div>
                      {newApiKey && (
                        <div className="p-4 border border-warning-200 bg-warning-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-warning" />
                            <span className="text-sm font-medium text-warning-700">
                              Save your API key now - it won&apos;t be shown again
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              value={newApiKey}
                              type={showApiKey ? "text" : "password"}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setShowApiKey(!showApiKey)}
                            >
                              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            <Button size="icon" variant="ghost" onClick={copyApiKey}>
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          leftIcon={RefreshCw}
                          onClick={apiKeyModal.onOpen}
                          isLoading={isGenerating}
                        >
                          Regenerate Key
                        </Button>
                        <Button
                          color="danger"
                          variant="ghost"
                          leftIcon={Trash2}
                          onClick={revokeModal.onOpen}
                        >
                          Revoke Key
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                        <Key className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm">No API key configured</span>
                      </div>
                      <Button
                        color="primary"
                        leftIcon={Key}
                        onClick={apiKeyModal.onOpen}
                        isLoading={isGenerating}
                      >
                        Generate API Key
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            ),
          },
          {
            key: "sessions",
            title: (
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4" />
                Sessions
              </div>
            ),
            content: (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <h3 className="text-lg font-semibold">Active Sessions</h3>
                  {sessions && sessions.length > 1 && (
                    <Button
                      color="danger"
                      variant="ghost"
                      size="sm"
                      onClick={revokeAllSessionsModal.onOpen}
                      isLoading={isRevokingAll}
                    >
                      Sign Out All Other Devices
                    </Button>
                  )}
                </CardHeader>
                <CardBody>
                  {sessionsLoading ? (
                    <Skeleton className="h-32 w-full rounded-lg" />
                  ) : sessions && sessions.length > 0 ? (
                    <div className="space-y-3">
                      {sessions.map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-4 border border-default-200 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                              {getDeviceIcon(session.deviceType)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{session.deviceName || "Unknown Device"}</p>
                                {session.isCurrent && (
                                  <Chip color="success" size="sm">Current</Chip>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {session.browser} • {session.os}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Last active: {new Date(session.lastActivity).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {!session.isCurrent && (
                            <Button
                              color="danger"
                              variant="ghost"
                              size="sm"
                              isLoading={isRevokingSession && revokingSessionId === session.id}
                              onClick={() => handleRevokeDeviceSession(session.id)}
                            >
                              Sign Out
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No active sessions found
                    </p>
                  )}
                </CardBody>
              </Card>
            ),
          },
        ] as TabItem[]}
      />

      {/* Generate API Key Modal */}
      <Modal isOpen={apiKeyModal.isOpen} onClose={apiKeyModal.onClose}>
        <ModalContent>
          <ModalHeader>
            {settings?.hasApiKey ? "Regenerate API Key" : "Generate API Key"}
          </ModalHeader>
          <ModalBody>
            {settings?.hasApiKey && (
              <div className="flex items-start gap-3 p-3 bg-warning-50 rounded-lg mb-4">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-sm text-warning-700">
                  Regenerating will invalidate your current API key. Any applications using
                  the old key will stop working.
                </p>
              </div>
            )}
            <p>
              {settings?.hasApiKey
                ? "Are you sure you want to regenerate your API key?"
                : "Generate an API key to access the Buzzi API programmatically."}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={apiKeyModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isGenerating}
              onClick={() => {
                handleGenerateApiKey();
                apiKeyModal.onClose();
              }}
            >
              {settings?.hasApiKey ? "Regenerate Key" : "Generate Key"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Revoke API Key Modal */}
      <Modal isOpen={revokeModal.isOpen} onClose={revokeModal.onClose}>
        <ModalContent>
          <ModalHeader className="text-danger">Revoke API Key</ModalHeader>
          <ModalBody>
            <div className="flex items-start gap-3 p-3 bg-danger-50 rounded-lg mb-4">
              <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger-700">
                This action cannot be undone. Any applications using this key will
                immediately lose access.
              </p>
            </div>
            <p>Are you sure you want to revoke your API key?</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={revokeModal.onClose}>
              Cancel
            </Button>
            <Button color="danger" isLoading={isRevoking} onClick={handleRevokeApiKey}>
              Revoke Key
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Revoke All Sessions Modal */}
      <Modal isOpen={revokeAllSessionsModal.isOpen} onClose={revokeAllSessionsModal.onClose}>
        <ModalContent>
          <ModalHeader className="text-danger">Sign Out All Other Devices</ModalHeader>
          <ModalBody>
            <div className="flex items-start gap-3 p-3 bg-danger-50 rounded-lg mb-4">
              <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger-700">
                This will sign out all other devices and sessions. You will remain
                signed in on this device.
              </p>
            </div>
            <p>Are you sure you want to sign out all other devices?</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={revokeAllSessionsModal.onClose}>
              Cancel
            </Button>
            <Button color="danger" isLoading={isRevokingAll} onClick={handleRevokeAllDeviceSessions}>
              Sign Out All
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
