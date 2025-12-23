"use client";

import { Key, Shield, Users } from "lucide-react";

import { Card, Input, Select, Switch } from "@/components/ui";

export interface AuthenticationSettingsData {
  allowEmailPasswordLogin: boolean;
  allowGoogleLogin: boolean;
  allowMicrosoftLogin: boolean;
  allowMagicLinkLogin: boolean;
  requireEmailVerification: boolean;
  allowSelfRegistration: boolean;
  defaultRole: string;
  invitationExpireDays: number;
  sessionDurationHours: number;
  rememberMeDurationDays: number;
  singleSessionOnly: boolean;
  logoutInactiveMinutes: number;
}

interface AuthenticationSettingsProps {
  settings: AuthenticationSettingsData;
  onChange: (updates: Partial<AuthenticationSettingsData>) => void;
}

const roleOptions = [
  { value: "support_agent", label: "Support Agent" },
  { value: "company_admin", label: "Company Admin" },
];

export function AuthenticationSettings({
  settings,
  onChange,
}: AuthenticationSettingsProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key size={20} />
          <h3 className="font-semibold">Login Methods</h3>
        </div>
        <p className="text-sm text-default-500 mb-4">
          Configure which authentication methods are available to users.
        </p>
        <div className="space-y-4">
          <Switch
            isSelected={settings.allowEmailPasswordLogin}
            onValueChange={(v) => onChange({ allowEmailPasswordLogin: v })}
          >
            Email & Password Login
          </Switch>
          <Switch
            isSelected={settings.allowGoogleLogin}
            onValueChange={(v) => onChange({ allowGoogleLogin: v })}
          >
            Google OAuth Login
          </Switch>
          <Switch
            isSelected={settings.allowMicrosoftLogin}
            onValueChange={(v) => onChange({ allowMicrosoftLogin: v })}
          >
            Microsoft OAuth Login
          </Switch>
          <Switch
            isSelected={settings.allowMagicLinkLogin}
            onValueChange={(v) => onChange({ allowMagicLinkLogin: v })}
          >
            Magic Link (Passwordless) Login
          </Switch>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users size={20} />
          <h3 className="font-semibold">Registration & Invitations</h3>
        </div>
        <div className="space-y-4">
          <Switch
            isSelected={settings.allowSelfRegistration}
            onValueChange={(v) => onChange({ allowSelfRegistration: v })}
          >
            Allow self-registration (without invitation)
          </Switch>
          <Switch
            isSelected={settings.requireEmailVerification}
            onValueChange={(v) => onChange({ requireEmailVerification: v })}
          >
            Require email verification before login
          </Switch>
        </div>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <Select
            label="Default Role for New Users"
            selectedKeys={new Set([settings.defaultRole])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              onChange({ defaultRole: selected });
            }}
            options={roleOptions}
            description="Role assigned to self-registered users"
          />
          <Input
            type="number"
            label="Invitation Expiration"
            value={String(settings.invitationExpireDays)}
            onValueChange={(v) =>
              onChange({ invitationExpireDays: parseInt(v) || 7 })
            }
            endContent={<span className="text-default-400 text-sm">days</span>}
            description="Days until invitation links expire"
          />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={20} />
          <h3 className="font-semibold">Session Management</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            type="number"
            label="Session Duration"
            value={String(settings.sessionDurationHours)}
            onValueChange={(v) =>
              onChange({ sessionDurationHours: parseInt(v) || 24 })
            }
            endContent={<span className="text-default-400 text-sm">hours</span>}
            description="How long sessions remain valid"
          />
          <Input
            type="number"
            label="Remember Me Duration"
            value={String(settings.rememberMeDurationDays)}
            onValueChange={(v) =>
              onChange({ rememberMeDurationDays: parseInt(v) || 30 })
            }
            endContent={<span className="text-default-400 text-sm">days</span>}
            description="Extended session for 'Remember Me'"
          />
          <Input
            type="number"
            label="Auto-logout After Inactivity"
            value={String(settings.logoutInactiveMinutes)}
            onValueChange={(v) =>
              onChange({ logoutInactiveMinutes: parseInt(v) || 60 })
            }
            endContent={<span className="text-default-400 text-sm">min</span>}
            description="0 to disable auto-logout"
          />
        </div>
        <div className="mt-4">
          <Switch
            isSelected={settings.singleSessionOnly}
            onValueChange={(v) => onChange({ singleSessionOnly: v })}
          >
            Enforce single session (logout previous sessions on new login)
          </Switch>
        </div>
      </Card>
    </div>
  );
}
