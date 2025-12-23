"use client";

import { Card, Input, Switch } from "@/components/ui";
import type { SecuritySettings as SecuritySettingsType } from "@/lib/settings";

interface SecuritySettingsProps {
  settings: SecuritySettingsType;
  onChange: (updates: Partial<SecuritySettingsType>) => void;
}

export function SecuritySettings({ settings, onChange }: SecuritySettingsProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Authentication</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Session Timeout (minutes)"
            type="number"
            value={settings.sessionTimeoutMinutes.toString()}
            onValueChange={(v) =>
              onChange({ sessionTimeoutMinutes: parseInt(v, 10) || 1440 })
            }
            description="How long before inactive sessions expire"
          />
          <Input
            label="Max Login Attempts"
            type="number"
            value={settings.maxLoginAttempts.toString()}
            onValueChange={(v) =>
              onChange({ maxLoginAttempts: parseInt(v, 10) || 5 })
            }
            description="Before account is locked"
          />
          <Input
            label="Lockout Duration (minutes)"
            type="number"
            value={settings.lockoutDurationMinutes.toString()}
            onValueChange={(v) =>
              onChange({ lockoutDurationMinutes: parseInt(v, 10) || 30 })
            }
            description="How long accounts stay locked"
          />
          <Input
            label="Password Min Length"
            type="number"
            value={settings.passwordMinLength.toString()}
            onValueChange={(v) =>
              onChange({ passwordMinLength: parseInt(v, 10) || 8 })
            }
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Password Requirements</h3>
        <div className="space-y-4">
          <Switch
            isSelected={settings.requireUppercase}
            onValueChange={(v) => onChange({ requireUppercase: v })}
          >
            Require uppercase letter
          </Switch>
          <Switch
            isSelected={settings.requireLowercase}
            onValueChange={(v) => onChange({ requireLowercase: v })}
          >
            Require lowercase letter
          </Switch>
          <Switch
            isSelected={settings.requireNumber}
            onValueChange={(v) => onChange({ requireNumber: v })}
          >
            Require number
          </Switch>
          <Switch
            isSelected={settings.requireSpecialChar}
            onValueChange={(v) => onChange({ requireSpecialChar: v })}
          >
            Require special character
          </Switch>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Two-Factor Authentication</h3>
        <div className="space-y-4">
          <Switch
            isSelected={settings.allow2fa}
            onValueChange={(v) => onChange({ allow2fa: v })}
          >
            Allow 2FA for all users
          </Switch>
          <Switch
            isSelected={settings.require2faMasterAdmin}
            onValueChange={(v) => onChange({ require2faMasterAdmin: v })}
          >
            Require 2FA for master admins
          </Switch>
          <Switch
            isSelected={settings.require2faCompanyAdmin}
            onValueChange={(v) => onChange({ require2faCompanyAdmin: v })}
          >
            Require 2FA for company admins
          </Switch>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">API Security</h3>
        <div className="space-y-4">
          <Switch
            isSelected={settings.requireApiAuth}
            onValueChange={(v) => onChange({ requireApiAuth: v })}
          >
            Require API key authentication
          </Switch>
          <Switch
            isSelected={settings.enableRateLimiting}
            onValueChange={(v) => onChange({ enableRateLimiting: v })}
          >
            Enable rate limiting
          </Switch>
          <Switch
            isSelected={settings.logApiRequests}
            onValueChange={(v) => onChange({ logApiRequests: v })}
          >
            Log all API requests
          </Switch>
        </div>
      </Card>
    </div>
  );
}
