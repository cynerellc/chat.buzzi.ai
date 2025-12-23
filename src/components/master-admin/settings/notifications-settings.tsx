"use client";

import { Bell, Mail, MessageSquare, Smartphone } from "lucide-react";

import { Card, Input, Select, Switch, Textarea } from "@/components/ui";

export interface NotificationsSettingsData {
  // Email notifications
  enableEmailNotifications: boolean;
  adminAlertEmails: string;
  sendWelcomeEmail: boolean;
  sendPasswordResetEmail: boolean;
  sendInvitationEmail: boolean;
  sendBillingAlerts: boolean;
  sendUsageLimitWarnings: boolean;
  usageLimitWarningThreshold: number;
  // System notifications
  enableSystemNotifications: boolean;
  notifyOnNewCompany: boolean;
  notifyOnCompanySuspension: boolean;
  notifyOnPaymentFailure: boolean;
  notifyOnHighUsage: boolean;
  highUsageThreshold: number;
  // Push notifications
  enablePushNotifications: boolean;
  pushNotificationProvider: string;
  // Slack integration
  enableSlackNotifications: boolean;
  slackWebhookUrl: string;
  slackChannelAlerts: string;
  // Digest settings
  enableDailyDigest: boolean;
  dailyDigestTime: string;
  enableWeeklyReport: boolean;
  weeklyReportDay: string;
}

interface NotificationsSettingsProps {
  settings: NotificationsSettingsData;
  onChange: (updates: Partial<NotificationsSettingsData>) => void;
}

const pushProviderOptions = [
  { value: "firebase", label: "Firebase Cloud Messaging" },
  { value: "onesignal", label: "OneSignal" },
  { value: "pusher", label: "Pusher" },
  { value: "none", label: "Disabled" },
];

const weekdayOptions = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

export function NotificationsSettings({
  settings,
  onChange,
}: NotificationsSettingsProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={20} />
          <h3 className="font-semibold">Email Notifications</h3>
        </div>
        <div className="space-y-4">
          <Switch
            isSelected={settings.enableEmailNotifications}
            onValueChange={(v) => onChange({ enableEmailNotifications: v })}
          >
            Enable email notifications
          </Switch>
          {settings.enableEmailNotifications && (
            <>
              <Textarea
                label="Admin Alert Emails"
                value={settings.adminAlertEmails}
                onValueChange={(v) => onChange({ adminAlertEmails: v })}
                placeholder="admin1@example.com, admin2@example.com"
                description="Comma-separated list of emails for system alerts"
                minRows={2}
              />
              <div className="grid gap-3 pt-2">
                <Switch
                  isSelected={settings.sendWelcomeEmail}
                  onValueChange={(v) => onChange({ sendWelcomeEmail: v })}
                >
                  Send welcome email to new users
                </Switch>
                <Switch
                  isSelected={settings.sendPasswordResetEmail}
                  onValueChange={(v) => onChange({ sendPasswordResetEmail: v })}
                >
                  Send password reset emails
                </Switch>
                <Switch
                  isSelected={settings.sendInvitationEmail}
                  onValueChange={(v) => onChange({ sendInvitationEmail: v })}
                >
                  Send invitation emails
                </Switch>
                <Switch
                  isSelected={settings.sendBillingAlerts}
                  onValueChange={(v) => onChange({ sendBillingAlerts: v })}
                >
                  Send billing and payment alerts
                </Switch>
                <div className="flex items-center gap-4">
                  <Switch
                    isSelected={settings.sendUsageLimitWarnings}
                    onValueChange={(v) =>
                      onChange({ sendUsageLimitWarnings: v })
                    }
                  >
                    Send usage limit warnings
                  </Switch>
                  {settings.sendUsageLimitWarnings && (
                    <Input
                      type="number"
                      value={String(settings.usageLimitWarningThreshold)}
                      onValueChange={(v) =>
                        onChange({
                          usageLimitWarningThreshold: parseInt(v) || 80,
                        })
                      }
                      endContent={
                        <span className="text-default-400 text-sm">%</span>
                      }
                      className="w-24"
                      size="sm"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={20} />
          <h3 className="font-semibold">System Notifications</h3>
        </div>
        <div className="space-y-4">
          <Switch
            isSelected={settings.enableSystemNotifications}
            onValueChange={(v) => onChange({ enableSystemNotifications: v })}
          >
            Enable in-app system notifications
          </Switch>
          {settings.enableSystemNotifications && (
            <div className="grid gap-3 pt-2">
              <Switch
                isSelected={settings.notifyOnNewCompany}
                onValueChange={(v) => onChange({ notifyOnNewCompany: v })}
              >
                Notify on new company registration
              </Switch>
              <Switch
                isSelected={settings.notifyOnCompanySuspension}
                onValueChange={(v) => onChange({ notifyOnCompanySuspension: v })}
              >
                Notify on company suspension
              </Switch>
              <Switch
                isSelected={settings.notifyOnPaymentFailure}
                onValueChange={(v) => onChange({ notifyOnPaymentFailure: v })}
              >
                Notify on payment failures
              </Switch>
              <div className="flex items-center gap-4">
                <Switch
                  isSelected={settings.notifyOnHighUsage}
                  onValueChange={(v) => onChange({ notifyOnHighUsage: v })}
                >
                  Notify on high usage
                </Switch>
                {settings.notifyOnHighUsage && (
                  <Input
                    type="number"
                    value={String(settings.highUsageThreshold)}
                    onValueChange={(v) =>
                      onChange({ highUsageThreshold: parseInt(v) || 90 })
                    }
                    endContent={
                      <span className="text-default-400 text-sm">%</span>
                    }
                    className="w-24"
                    size="sm"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone size={20} />
          <h3 className="font-semibold">Push Notifications</h3>
        </div>
        <div className="space-y-4">
          <Switch
            isSelected={settings.enablePushNotifications}
            onValueChange={(v) => onChange({ enablePushNotifications: v })}
          >
            Enable push notifications
          </Switch>
          {settings.enablePushNotifications && (
            <Select
              label="Push Notification Provider"
              selectedKeys={new Set([settings.pushNotificationProvider])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                onChange({ pushNotificationProvider: selected });
              }}
              options={pushProviderOptions}
              className="max-w-md"
            />
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={20} />
          <h3 className="font-semibold">Slack Integration</h3>
        </div>
        <div className="space-y-4">
          <Switch
            isSelected={settings.enableSlackNotifications}
            onValueChange={(v) => onChange({ enableSlackNotifications: v })}
          >
            Enable Slack notifications
          </Switch>
          {settings.enableSlackNotifications && (
            <div className="grid gap-4 pt-2">
              <Input
                type="url"
                label="Slack Webhook URL"
                value={settings.slackWebhookUrl}
                onValueChange={(v) => onChange({ slackWebhookUrl: v })}
                placeholder="https://hooks.slack.com/services/..."
                description="Incoming webhook URL for Slack notifications"
              />
              <Input
                label="Alert Channel"
                value={settings.slackChannelAlerts}
                onValueChange={(v) => onChange({ slackChannelAlerts: v })}
                placeholder="#alerts"
                description="Channel for critical alerts"
              />
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Digest & Reports</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Switch
              isSelected={settings.enableDailyDigest}
              onValueChange={(v) => onChange({ enableDailyDigest: v })}
            >
              Send daily digest email
            </Switch>
            {settings.enableDailyDigest && (
              <Input
                type="time"
                value={settings.dailyDigestTime}
                onValueChange={(v) => onChange({ dailyDigestTime: v })}
                className="w-32"
                size="sm"
              />
            )}
          </div>
          <div className="flex items-center gap-4">
            <Switch
              isSelected={settings.enableWeeklyReport}
              onValueChange={(v) => onChange({ enableWeeklyReport: v })}
            >
              Send weekly report
            </Switch>
            {settings.enableWeeklyReport && (
              <Select
                selectedKeys={new Set([settings.weeklyReportDay])}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  onChange({ weeklyReportDay: selected });
                }}
                options={weekdayOptions}
                className="w-40"
                size="sm"
              />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
