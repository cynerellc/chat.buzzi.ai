"use client";

import { CheckCircle, XCircle, RefreshCw } from "lucide-react";

import { Badge, Button, Card, Skeleton } from "@/components/ui";
import { useIntegrations, type IntegrationStatus } from "@/hooks/master-admin";

function getIntegrationIcon(type: string) {
  switch (type) {
    case "ai":
      return "AI";
    case "email":
      return "Email";
    case "database":
      return "DB";
    case "storage":
      return "Storage";
    default:
      return "Int";
  }
}

interface IntegrationCardProps {
  integration: IntegrationStatus;
}

function IntegrationCard({ integration }: IntegrationCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-default-100 rounded-lg flex items-center justify-center text-xs font-medium text-default-600">
            {getIntegrationIcon(integration.type)}
          </div>
          <div>
            <h4 className="font-medium">{integration.name}</h4>
            <p className="text-sm text-default-500 capitalize">
              {integration.type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {integration.connected ? (
            <Badge variant="success" className="flex items-center gap-1">
              <CheckCircle size={12} />
              Connected
            </Badge>
          ) : (
            <Badge variant="danger" className="flex items-center gap-1">
              <XCircle size={12} />
              Not Connected
            </Badge>
          )}
        </div>
      </div>
      {integration.error && (
        <p className="text-sm text-danger mt-2">{integration.error}</p>
      )}
      {integration.lastChecked && (
        <p className="text-xs text-default-400 mt-2">
          Last checked:{" "}
          {new Date(integration.lastChecked).toLocaleString()}
        </p>
      )}
    </Card>
  );
}

export function IntegrationsSettings() {
  const { integrations, isLoading, mutate } = useIntegrations();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Platform Integrations</h3>
        <Button
          variant="flat"
          size="sm"
          startContent={<RefreshCw size={14} />}
          onPress={() => mutate()}
        >
          Refresh Status
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((integration) => (
          <IntegrationCard key={integration.name} integration={integration} />
        ))}
      </div>

      <Card className="p-6 bg-default-50">
        <p className="text-sm text-default-600">
          Integration settings are managed through environment variables.
          Update your deployment configuration to add or modify integrations.
        </p>
      </Card>
    </div>
  );
}
