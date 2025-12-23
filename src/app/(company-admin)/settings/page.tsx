"use client";

import {
  addToast,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Skeleton,
  Switch,
  Tab,
  Tabs,
  Textarea,
  useDisclosure,
} from "@heroui/react";
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync state with prop changes
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
            <Button color="primary" isLoading={isUpdating} onPress={handleSave}>
              Save Changes
            </Button>
          )
        }
      />

      <Tabs aria-label="Settings tabs" color="primary" variant="underlined">
        {/* General Settings */}
        <Tab key="general" title={<div className="flex items-center gap-2"><Building2 className="w-4 h-4" />General</div>}>
          <Card className="mt-4">
            <CardHeader>
              <h3 className="text-lg font-semibold">Company Information</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Company Name"
                placeholder="Your Company Name"
                value={formData.name}
                onValueChange={(value) => updateFormField("name", value)}
              />
              <Textarea
                label="Description"
                placeholder="Brief description of your company"
                value={formData.description}
                onValueChange={(value) => updateFormField("description", value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Timezone"
                  placeholder="Select timezone"
                  selectedKeys={[formData.timezone]}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) updateFormField("timezone", selected);
                  }}
                >
                  {timezones.map((tz) => (
                    <SelectItem key={tz.key}>{tz.label}</SelectItem>
                  ))}
                </Select>
                <Select
                  label="Language"
                  placeholder="Select language"
                  selectedKeys={[formData.locale]}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) updateFormField("locale", selected);
                  }}
                >
                  {locales.map((locale) => (
                    <SelectItem key={locale.key}>{locale.label}</SelectItem>
                  ))}
                </Select>
              </div>
            </CardBody>
          </Card>
        </Tab>

        {/* Branding */}
        <Tab key="branding" title={<div className="flex items-center gap-2"><Palette className="w-4 h-4" />Branding</div>}>
          <Card className="mt-4">
            <CardHeader>
              <h3 className="text-lg font-semibold">Brand Customization</h3>
            </CardHeader>
            <CardBody className="space-y-6">
              <Input
                label="Logo URL"
                placeholder="https://example.com/logo.png"
                value={formData.logoUrl}
                onValueChange={(value) => updateFormField("logoUrl", value)}
                description="URL to your company logo (recommended: 200x50px)"
              />

              <Divider />

              <div>
                <h4 className="text-sm font-medium mb-4">Brand Colors</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm text-default-600">Primary Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => updateFormField("primaryColor", e.target.value)}
                        className="w-12 h-12 rounded-lg cursor-pointer border-2 border-default-200"
                      />
                      <Input
                        value={formData.primaryColor}
                        onValueChange={(value) => updateFormField("primaryColor", value)}
                        className="flex-1"
                        placeholder="#6437F3"
                      />
                    </div>
                    <p className="text-xs text-default-400">Used for buttons and key UI elements</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-default-600">Secondary Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={formData.secondaryColor}
                        onChange={(e) => updateFormField("secondaryColor", e.target.value)}
                        className="w-12 h-12 rounded-lg cursor-pointer border-2 border-default-200"
                      />
                      <Input
                        value={formData.secondaryColor}
                        onValueChange={(value) => updateFormField("secondaryColor", value)}
                        className="flex-1"
                        placeholder="#2b3dd8"
                      />
                    </div>
                    <p className="text-xs text-default-400">Used for accents and highlights</p>
                  </div>
                </div>
              </div>

              <Divider />

              <div className="flex items-center gap-4 p-4 bg-default-100 rounded-lg">
                <div
                  className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: formData.primaryColor }}
                >
                  {formData.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{formData.name || "Company Name"}</p>
                  <p className="text-sm text-default-500">Preview of your brand colors</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </Tab>

        {/* Notifications */}
        <Tab key="notifications" title={<div className="flex items-center gap-2"><Bell className="w-4 h-4" />Notifications</div>}>
          <Card className="mt-4">
            <CardHeader>
              <h3 className="text-lg font-semibold">Notification Preferences</h3>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-default-500">Receive email alerts for important events</p>
                  </div>
                  <Switch
                    isSelected={formData.notificationSettings.emailNotifications}
                    onValueChange={(value) => updateNotificationSetting("emailNotifications", value)}
                  />
                </div>

                <Divider />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Escalation Alerts</p>
                    <p className="text-sm text-default-500">Get notified when conversations are escalated to humans</p>
                  </div>
                  <Switch
                    isSelected={formData.notificationSettings.escalationAlerts}
                    onValueChange={(value) => updateNotificationSetting("escalationAlerts", value)}
                  />
                </div>

                <Divider />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Daily Digest</p>
                    <p className="text-sm text-default-500">Receive a daily summary of activity</p>
                  </div>
                  <Switch
                    isSelected={formData.notificationSettings.dailyDigest}
                    onValueChange={(value) => updateNotificationSetting("dailyDigest", value)}
                  />
                </div>

                <Divider />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Weekly Report</p>
                    <p className="text-sm text-default-500">Receive weekly analytics and performance reports</p>
                  </div>
                  <Switch
                    isSelected={formData.notificationSettings.weeklyReport}
                    onValueChange={(value) => updateNotificationSetting("weeklyReport", value)}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </Tab>

        {/* Security */}
        <Tab key="security" title={<div className="flex items-center gap-2"><Shield className="w-4 h-4" />Security</div>}>
          <Card className="mt-4">
            <CardHeader>
              <h3 className="text-lg font-semibold">Security Settings</h3>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Require Two-Factor Authentication</p>
                  <p className="text-sm text-default-500">Require 2FA for all team members</p>
                </div>
                <Switch
                  isSelected={formData.securitySettings.requireTwoFactor}
                  onValueChange={(value) => updateSecuritySetting("requireTwoFactor", value)}
                />
              </div>

              <Divider />

              <div>
                <label className="text-sm font-medium">Session Timeout (minutes)</label>
                <Input
                  type="number"
                  min={5}
                  max={1440}
                  value={formData.securitySettings.sessionTimeout.toString()}
                  onValueChange={(value) => updateSecuritySetting("sessionTimeout", parseInt(value) || 60)}
                  className="mt-2 max-w-xs"
                  description="How long before inactive users are logged out"
                />
              </div>

              <Divider />

              <div>
                <label className="text-sm font-medium">IP Whitelist</label>
                <p className="text-sm text-default-500 mb-3">Restrict access to specific IP addresses</p>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Enter IP address (e.g., 192.168.1.1)"
                    value={ipInput}
                    onValueChange={setIpInput}
                    className="flex-1"
                  />
                  <Button color="primary" onPress={addIpToWhitelist}>
                    Add
                  </Button>
                </div>
                {formData.securitySettings.ipWhitelist.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {formData.securitySettings.ipWhitelist.map((ip) => (
                      <Chip
                        key={ip}
                        onClose={() => removeIpFromWhitelist(ip)}
                        variant="flat"
                      >
                        {ip}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-default-400">No IP restrictions - all IPs allowed</p>
                )}
              </div>

              <Divider />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Allow Public API Access</p>
                  <p className="text-sm text-default-500">Enable API access from external applications</p>
                </div>
                <Switch
                  isSelected={formData.securitySettings.allowPublicApi}
                  onValueChange={(value) => updateSecuritySetting("allowPublicApi", value)}
                />
              </div>
            </CardBody>
          </Card>
        </Tab>

        {/* API Access */}
        <Tab key="api" title={<div className="flex items-center gap-2"><Key className="w-4 h-4" />API</div>}>
          <Card className="mt-4">
            <CardHeader>
              <h3 className="text-lg font-semibold">API Access</h3>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="p-4 bg-default-100 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-medium">API Key</p>
                    <p className="text-sm text-default-500">
                      Use this key to authenticate API requests
                    </p>
                  </div>
                  {settings?.hasApiKey ? (
                    <Chip color="success" variant="flat" startContent={<Check className="w-3 h-3" />}>
                      Active
                    </Chip>
                  ) : (
                    <Chip color="default" variant="flat">
                      Not configured
                    </Chip>
                  )}
                </div>

                {settings?.hasApiKey ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-3 bg-default-200 rounded-lg font-mono text-sm">
                        {settings.apiKeyPrefix}••••••••••••••••••••••••
                      </code>
                      <Button
                        color="danger"
                        variant="flat"
                        startContent={<Trash2 className="w-4 h-4" />}
                        onPress={revokeModal.onOpen}
                      >
                        Revoke
                      </Button>
                    </div>
                    <Button
                      variant="flat"
                      startContent={<RefreshCw className="w-4 h-4" />}
                      onPress={apiKeyModal.onOpen}
                    >
                      Regenerate Key
                    </Button>
                  </div>
                ) : (
                  <Button
                    color="primary"
                    startContent={<Key className="w-4 h-4" />}
                    isLoading={isGenerating}
                    onPress={apiKeyModal.onOpen}
                  >
                    Generate API Key
                  </Button>
                )}
              </div>

              {newApiKey && (
                <div className="p-4 border-2 border-warning rounded-lg bg-warning-50">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-warning-700">Save your API key</p>
                      <p className="text-sm text-warning-600 mb-3">
                        This key will only be shown once. Copy it now and store it securely.
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-3 bg-white rounded-lg font-mono text-sm break-all">
                          {showApiKey ? newApiKey : "•".repeat(newApiKey.length)}
                        </code>
                        <Button
                          isIconOnly
                          variant="flat"
                          onPress={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button
                          isIconOnly
                          color="primary"
                          onPress={copyApiKey}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Divider />

              <div>
                <h4 className="font-medium mb-2">Custom Domain</h4>
                <p className="text-sm text-default-500 mb-4">
                  Configure a custom domain for your widget and API
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="widget.yourcompany.com"
                    value={formData.customDomain}
                    onValueChange={(value) => updateFormField("customDomain", value)}
                    startContent={<Globe className="w-4 h-4 text-default-400" />}
                    className="flex-1"
                  />
                  {settings?.customDomainVerified ? (
                    <Chip color="success" variant="flat" startContent={<Check className="w-3 h-3" />}>
                      Verified
                    </Chip>
                  ) : settings?.customDomain ? (
                    <Chip color="warning" variant="flat">
                      Pending
                    </Chip>
                  ) : null}
                </div>
                {settings?.customDomain && !settings?.customDomainVerified && (
                  <p className="text-xs text-default-400 mt-2">
                    Add a CNAME record pointing to widget.buzzi.ai to verify your domain
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        </Tab>

        {/* Sessions */}
        <Tab key="sessions" title={<div className="flex items-center gap-2"><Laptop className="w-4 h-4" />Sessions</div>}>
          <Card className="mt-4">
            <CardHeader className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Active Sessions</h3>
                <p className="text-sm text-default-500">Manage your active login sessions and devices</p>
              </div>
              {sessions.length > 1 && (
                <Button
                  color="danger"
                  variant="flat"
                  startContent={<Trash2 className="w-4 h-4" />}
                  onPress={revokeAllSessionsModal.onOpen}
                  isLoading={isRevokingAll}
                >
                  Sign Out All Other Devices
                </Button>
              )}
            </CardHeader>
            <CardBody className="space-y-4">
              {sessionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-default-500">
                  <Laptop className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No active sessions found</p>
                </div>
              ) : (
                sessions.map((deviceSession) => (
                  <div
                    key={deviceSession.id}
                    className={`p-4 rounded-lg border ${
                      deviceSession.isCurrent
                        ? "border-primary bg-primary-50"
                        : "border-default-200 bg-default-50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${deviceSession.isCurrent ? "bg-primary-100" : "bg-default-100"}`}>
                          {getDeviceIcon(deviceSession.deviceType)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {deviceSession.deviceName || "Unknown Device"}
                            </p>
                            {deviceSession.isCurrent && (
                              <Chip size="sm" color="primary" variant="flat">
                                Current Session
                              </Chip>
                            )}
                            {deviceSession.isTrusted && (
                              <Chip size="sm" color="success" variant="flat">
                                Trusted
                              </Chip>
                            )}
                          </div>
                          <p className="text-sm text-default-500">
                            {deviceSession.browser} on {deviceSession.os}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-default-400">
                            {deviceSession.ipAddress && (
                              <span>IP: {deviceSession.ipAddress}</span>
                            )}
                            {deviceSession.location && (
                              <span>{deviceSession.location}</span>
                            )}
                            <span>
                              Last active: {new Date(deviceSession.lastActivity).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      {!deviceSession.isCurrent && (
                        <Button
                          color="danger"
                          variant="light"
                          size="sm"
                          isLoading={revokingSessionId === deviceSession.id || isRevokingSession}
                          onPress={() => handleRevokeDeviceSession(deviceSession.id)}
                        >
                          Sign Out
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </Tab>
      </Tabs>

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
            <Button variant="light" onPress={apiKeyModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isGenerating}
              onPress={() => {
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
            <Button variant="light" onPress={revokeModal.onClose}>
              Cancel
            </Button>
            <Button color="danger" isLoading={isRevoking} onPress={handleRevokeApiKey}>
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
            <Button variant="light" onPress={revokeAllSessionsModal.onClose}>
              Cancel
            </Button>
            <Button color="danger" isLoading={isRevokingAll} onPress={handleRevokeAllDeviceSessions}>
              Sign Out All
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
