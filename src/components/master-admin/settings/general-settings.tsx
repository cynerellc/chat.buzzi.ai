"use client";

import { Card, Input, Select, Switch } from "@/components/ui";
import type { GeneralSettings as GeneralSettingsType } from "@/lib/settings";

const timezoneOptions = [
  { value: "America/New_York", label: "America/New_York (EST)" },
  { value: "America/Chicago", label: "America/Chicago (CST)" },
  { value: "America/Denver", label: "America/Denver (MST)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST)" },
  { value: "Europe/London", label: "Europe/London (GMT)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "UTC", label: "UTC" },
];

const languageOptions = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
];

interface GeneralSettingsProps {
  settings: GeneralSettingsType;
  onChange: (updates: Partial<GeneralSettingsType>) => void;
}

export function GeneralSettings({ settings, onChange }: GeneralSettingsProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Platform Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Platform Name"
            value={settings.platformName}
            onValueChange={(v) => onChange({ platformName: v })}
          />
          <Input
            label="Support Email"
            type="email"
            value={settings.supportEmail}
            onValueChange={(v) => onChange({ supportEmail: v })}
          />
          <Select
            label="Default Timezone"
            selectedKeys={new Set([settings.defaultTimezone])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              onChange({ defaultTimezone: selected });
            }}
            options={timezoneOptions}
          />
          <Select
            label="Default Language"
            selectedKeys={new Set([settings.defaultLanguage])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              onChange({ defaultLanguage: selected });
            }}
            options={languageOptions}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Feature Flags</h3>
        <div className="space-y-4">
          <Switch
            isSelected={settings.allowRegistrations}
            onValueChange={(v) => onChange({ allowRegistrations: v })}
          >
            Allow new company registrations
          </Switch>
          <Switch
            isSelected={settings.enableTrial}
            onValueChange={(v) => onChange({ enableTrial: v })}
          >
            Enable trial period for new companies
          </Switch>
          <Switch
            isSelected={settings.maintenanceMode}
            onValueChange={(v) => onChange({ maintenanceMode: v })}
            color="warning"
          >
            Maintenance mode (disable all access except master admins)
          </Switch>
          <Switch
            isSelected={settings.enablePublicApi}
            onValueChange={(v) => onChange({ enablePublicApi: v })}
          >
            Enable public API
          </Switch>
        </div>
      </Card>
    </div>
  );
}
