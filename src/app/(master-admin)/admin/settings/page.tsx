"use client";

import { Save } from "lucide-react";
import { useState, useCallback, useMemo } from "react";

import { PageHeader } from "@/components/layouts";
import {
  GeneralSettings,
  EmailSettings,
  AISettings,
  SecuritySettings,
  IntegrationsSettings,
  MaintenanceSettings,
} from "@/components/master-admin/settings";
import { Button, Tabs, Skeleton, Card, type TabItem } from "@/components/ui";
import {
  useSystemSettings,
  updateSettings,
  type SystemSettings,
} from "@/hooks/master-admin";

type TabKey = "general" | "email" | "ai" | "security" | "integrations" | "maintenance";

export default function SettingsPage() {
  const { settings, isLoading, mutate } = useSystemSettings();
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [pendingChanges, setPendingChanges] = useState<Partial<SystemSettings>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasChanges = Object.keys(pendingChanges).length > 0;

  const handleChange = useCallback(
    <K extends keyof SystemSettings>(
      section: K,
      updates: Partial<SystemSettings[K]>
    ) => {
      setPendingChanges((prev) => ({
        ...prev,
        [section]: {
          ...(prev[section] as SystemSettings[K] | undefined),
          ...(settings?.[section] ?? {}),
          ...updates,
        },
      }));
    },
    [settings]
  );

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await updateSettings(pendingChanges);
      setPendingChanges({});
      mutate();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save settings"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPendingChanges({});
  };

  // Merge pending changes with current settings and create tab items
  const tabItems: TabItem[] = useMemo(() => {
    const mergedSettings: SystemSettings | undefined = settings
      ? {
          general: { ...settings.general, ...pendingChanges.general },
          email: { ...settings.email, ...pendingChanges.email },
          ai: { ...settings.ai, ...pendingChanges.ai },
          security: { ...settings.security, ...pendingChanges.security },
          maintenance: { ...settings.maintenance, ...pendingChanges.maintenance },
        }
      : undefined;

    return [
      {
        key: "general",
        label: "General",
        content: mergedSettings && (
          <GeneralSettings
            settings={mergedSettings.general}
            onChange={(updates) => handleChange("general", updates)}
          />
        ),
      },
      {
        key: "email",
        label: "Email",
        content: mergedSettings && (
          <EmailSettings
            settings={mergedSettings.email}
            onChange={(updates) => handleChange("email", updates)}
          />
        ),
      },
      {
        key: "ai",
        label: "AI",
        content: mergedSettings && (
          <AISettings
            settings={mergedSettings.ai}
            onChange={(updates) => handleChange("ai", updates)}
          />
        ),
      },
      {
        key: "security",
        label: "Security",
        content: mergedSettings && (
          <SecuritySettings
            settings={mergedSettings.security}
            onChange={(updates) => handleChange("security", updates)}
          />
        ),
      },
      {
        key: "integrations",
        label: "Integrations",
        content: <IntegrationsSettings />,
      },
      {
        key: "maintenance",
        label: "Maintenance",
        content: mergedSettings && (
          <MaintenanceSettings
            settings={mergedSettings.maintenance}
            onChange={(updates) => handleChange("maintenance", updates)}
          />
        ),
      },
    ];
  }, [settings, pendingChanges, handleChange]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="p-6">
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="System Settings"
        description="Configure platform-wide settings and preferences"
        showBack
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Settings" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button variant="flat" onPress={handleReset}>
                Reset
              </Button>
            )}
            <Button
              color="primary"
              startContent={<Save size={16} />}
              onPress={handleSave}
              isLoading={isSaving}
              isDisabled={!hasChanges}
            >
              Save Changes
            </Button>
          </div>
        }
      />

      {saveError && (
        <div className="p-3 bg-danger-50 text-danger-700 rounded-lg text-sm mb-6">
          {saveError}
        </div>
      )}

      {hasChanges && (
        <div className="p-3 bg-warning-50 text-warning-700 rounded-lg text-sm mb-6">
          You have unsaved changes. Don&apos;t forget to save before leaving.
        </div>
      )}

      <Tabs
        items={tabItems}
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as TabKey)}
        aria-label="Settings tabs"
        classNames={{
          tabList: "mb-6",
        }}
      />
    </div>
  );
}
