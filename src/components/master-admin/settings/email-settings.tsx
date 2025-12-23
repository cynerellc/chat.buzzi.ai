"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { Button, Card, Input, Switch } from "@/components/ui";
import type { EmailSettings as EmailSettingsType } from "@/lib/settings";
import { testEmailConnection } from "@/hooks/master-admin";

interface EmailSettingsProps {
  settings: EmailSettingsType;
  onChange: (updates: Partial<EmailSettingsType>) => void;
}

export function EmailSettings({ settings, onChange }: EmailSettingsProps) {
  const [testEmail, setTestEmail] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleTestEmail = async () => {
    if (!testEmail) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testEmailConnection(testEmail);
      setTestResult({
        success: result.success,
        message: result.message ?? result.error ?? "Unknown result",
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Test failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">SMTP Configuration</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="SMTP Host"
            placeholder="smtp.example.com"
            value={settings.smtpHost}
            onValueChange={(v) => onChange({ smtpHost: v })}
          />
          <Input
            label="SMTP Port"
            type="number"
            placeholder="587"
            value={settings.smtpPort.toString()}
            onValueChange={(v) => onChange({ smtpPort: parseInt(v, 10) || 587 })}
          />
          <Input
            label="SMTP Username"
            placeholder="apikey"
            value={settings.smtpUsername}
            onValueChange={(v) => onChange({ smtpUsername: v })}
          />
          <Input
            label="SMTP Password"
            type="password"
            placeholder="Enter SMTP password"
            value={settings.smtpPassword}
            onValueChange={(v) => onChange({ smtpPassword: v })}
          />
          <Input
            label="From Email"
            type="email"
            placeholder="noreply@example.com"
            value={settings.fromEmail}
            onValueChange={(v) => onChange({ fromEmail: v })}
          />
          <Input
            label="From Name"
            placeholder="Platform Name"
            value={settings.fromName}
            onValueChange={(v) => onChange({ fromName: v })}
          />
        </div>
        <div className="mt-4">
          <Switch
            isSelected={settings.smtpSecure}
            onValueChange={(v) => onChange({ smtpSecure: v })}
          >
            Use SSL/TLS
          </Switch>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Test Email Configuration</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Input
              label="Test Recipient Email"
              type="email"
              placeholder="test@example.com"
              value={testEmail}
              onValueChange={setTestEmail}
            />
          </div>
          <Button
            color="primary"
            variant="flat"
            startContent={<Send size={16} />}
            onPress={handleTestEmail}
            isLoading={isTesting}
            isDisabled={!testEmail}
          >
            Send Test Email
          </Button>
        </div>
        {testResult && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              testResult.success
                ? "bg-success-50 text-success-700"
                : "bg-danger-50 text-danger-700"
            }`}
          >
            {testResult.message}
          </div>
        )}
      </Card>
    </div>
  );
}
