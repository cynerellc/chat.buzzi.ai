"use client";

import { AlertTriangle, Database, MessageSquare, Users } from "lucide-react";

import { Card, Input, Switch } from "@/components/ui";

export interface LimitsSettingsData {
  maxCompaniesPerPlan: {
    free: number;
    starter: number;
    professional: number;
    enterprise: number;
  };
  maxAgentsPerCompany: number;
  maxUsersPerCompany: number;
  maxConversationsPerDay: number;
  maxMessagesPerConversation: number;
  maxFileUploadSizeMB: number;
  maxStoragePerCompanyGB: number;
  maxApiRequestsPerMinute: number;
  maxWebhooksPerCompany: number;
  enableRateLimiting: boolean;
  rateLimitBurstSize: number;
}

interface LimitsSettingsProps {
  settings: LimitsSettingsData;
  onChange: (updates: Partial<LimitsSettingsData>) => void;
}

export function LimitsSettings({ settings, onChange }: LimitsSettingsProps) {
  const handlePlanLimitChange = (
    plan: keyof LimitsSettingsData["maxCompaniesPerPlan"],
    value: number
  ) => {
    onChange({
      maxCompaniesPerPlan: {
        ...settings.maxCompaniesPerPlan,
        [plan]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={20}
            className="text-warning-600 shrink-0 mt-0.5"
          />
          <div>
            <h3 className="font-semibold text-warning-800 mb-1">
              Platform Limits
            </h3>
            <p className="text-sm text-warning-700">
              These settings define platform-wide resource limits. Changing
              these values will affect all companies. Use caution when modifying
              these settings in production.
            </p>
          </div>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users size={20} />
          <h3 className="font-semibold">Company Limits</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            type="number"
            label="Max Agents per Company"
            value={String(settings.maxAgentsPerCompany)}
            onValueChange={(v) =>
              onChange({ maxAgentsPerCompany: parseInt(v) || 10 })
            }
            description="Maximum number of AI agents a company can create"
          />
          <Input
            type="number"
            label="Max Users per Company"
            value={String(settings.maxUsersPerCompany)}
            onValueChange={(v) =>
              onChange({ maxUsersPerCompany: parseInt(v) || 50 })
            }
            description="Maximum team members per company"
          />
          <Input
            type="number"
            label="Max Webhooks per Company"
            value={String(settings.maxWebhooksPerCompany)}
            onValueChange={(v) =>
              onChange({ maxWebhooksPerCompany: parseInt(v) || 10 })
            }
            description="Maximum webhook integrations"
          />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={20} />
          <h3 className="font-semibold">Conversation Limits</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            type="number"
            label="Max Conversations per Day"
            value={String(settings.maxConversationsPerDay)}
            onValueChange={(v) =>
              onChange({ maxConversationsPerDay: parseInt(v) || 1000 })
            }
            description="Daily limit per company (0 = unlimited)"
          />
          <Input
            type="number"
            label="Max Messages per Conversation"
            value={String(settings.maxMessagesPerConversation)}
            onValueChange={(v) =>
              onChange({ maxMessagesPerConversation: parseInt(v) || 100 })
            }
            description="Message limit before conversation closes"
          />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database size={20} />
          <h3 className="font-semibold">Storage & Files</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            type="number"
            label="Max File Upload Size"
            value={String(settings.maxFileUploadSizeMB)}
            onValueChange={(v) =>
              onChange({ maxFileUploadSizeMB: parseInt(v) || 10 })
            }
            endContent={<span className="text-default-400 text-sm">MB</span>}
            description="Maximum size for individual file uploads"
          />
          <Input
            type="number"
            label="Max Storage per Company"
            value={String(settings.maxStoragePerCompanyGB)}
            onValueChange={(v) =>
              onChange({ maxStoragePerCompanyGB: parseInt(v) || 5 })
            }
            endContent={<span className="text-default-400 text-sm">GB</span>}
            description="Total storage allocation per company"
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Rate Limiting</h3>
        <div className="space-y-4">
          <Switch
            isSelected={settings.enableRateLimiting}
            onValueChange={(v) => onChange({ enableRateLimiting: v })}
          >
            Enable API rate limiting
          </Switch>
          {settings.enableRateLimiting && (
            <div className="grid gap-4 md:grid-cols-2 pt-2">
              <Input
                type="number"
                label="Max API Requests per Minute"
                value={String(settings.maxApiRequestsPerMinute)}
                onValueChange={(v) =>
                  onChange({ maxApiRequestsPerMinute: parseInt(v) || 60 })
                }
                description="Per-company API rate limit"
              />
              <Input
                type="number"
                label="Rate Limit Burst Size"
                value={String(settings.rateLimitBurstSize)}
                onValueChange={(v) =>
                  onChange({ rateLimitBurstSize: parseInt(v) || 100 })
                }
                description="Allowed burst before rate limiting kicks in"
              />
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Per-Plan Company Limits</h3>
        <p className="text-sm text-default-500 mb-4">
          Override the maximum number of companies allowed per subscription
          plan.
        </p>
        <div className="grid gap-4 md:grid-cols-4">
          <Input
            type="number"
            label="Free Plan"
            value={String(settings.maxCompaniesPerPlan.free)}
            onValueChange={(v) =>
              handlePlanLimitChange("free", parseInt(v) || 0)
            }
            description="Companies on free tier"
          />
          <Input
            type="number"
            label="Starter Plan"
            value={String(settings.maxCompaniesPerPlan.starter)}
            onValueChange={(v) =>
              handlePlanLimitChange("starter", parseInt(v) || 0)
            }
            description="Companies on starter"
          />
          <Input
            type="number"
            label="Professional Plan"
            value={String(settings.maxCompaniesPerPlan.professional)}
            onValueChange={(v) =>
              handlePlanLimitChange("professional", parseInt(v) || 0)
            }
            description="Companies on pro"
          />
          <Input
            type="number"
            label="Enterprise Plan"
            value={String(settings.maxCompaniesPerPlan.enterprise)}
            onValueChange={(v) =>
              handlePlanLimitChange("enterprise", parseInt(v) || 0)
            }
            description="Unlimited (-1)"
          />
        </div>
      </Card>
    </div>
  );
}
