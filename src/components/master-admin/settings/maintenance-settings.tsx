"use client";

import { AlertTriangle, Database, Trash2 } from "lucide-react";

import { Button, Card, Switch, Textarea } from "@/components/ui";
import type { MaintenanceSettings as MaintenanceSettingsType } from "@/lib/settings";

interface MaintenanceSettingsProps {
  settings: MaintenanceSettingsType;
  onChange: (updates: Partial<MaintenanceSettingsType>) => void;
}

export function MaintenanceSettings({
  settings,
  onChange,
}: MaintenanceSettingsProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Database Operations</h3>
        <p className="text-sm text-default-500 mb-4">
          These operations affect the database. Use with caution.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            startContent={<Database size={16} />}
            isDisabled
          >
            Run Database Migrations
          </Button>
          <Button variant="secondary" isDisabled>
            Seed Sample Data
          </Button>
          <Button
            variant="secondary"
            color="warning"
            startContent={<Trash2 size={16} />}
            isDisabled
          >
            Clear Test Data
          </Button>
        </div>
        <p className="text-xs text-default-400 mt-2">
          Database operations are managed through CLI commands
        </p>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Cache Management</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" isDisabled>
            Clear All Caches
          </Button>
          <Button variant="secondary" isDisabled>
            Clear Session Cache
          </Button>
          <Button variant="secondary" isDisabled>
            Clear API Cache
          </Button>
        </div>
        <p className="text-xs text-default-400 mt-2">
          Cache clearing is automatically handled by the system
        </p>
      </Card>

      <Card className="p-6 border-2 border-warning-200">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="text-warning shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold">Maintenance Mode</h3>
            <p className="text-sm text-default-500">
              When enabled, all users except master admins will see a
              maintenance message and cannot access the platform.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Switch
            isSelected={settings.maintenanceMode}
            onValueChange={(v) => onChange({ maintenanceMode: v })}
            color="warning"
          >
            Enable maintenance mode
          </Switch>

          <Switch
            isSelected={settings.allowMasterAdminAccess}
            onValueChange={(v) => onChange({ allowMasterAdminAccess: v })}
          >
            Allow master admin access during maintenance
          </Switch>

          <Textarea
            label="Maintenance Message"
            placeholder="Enter the message users will see during maintenance..."
            value={settings.maintenanceMessage}
            onValueChange={(v) => onChange({ maintenanceMessage: v })}
            minRows={3}
          />
        </div>
      </Card>
    </div>
  );
}
