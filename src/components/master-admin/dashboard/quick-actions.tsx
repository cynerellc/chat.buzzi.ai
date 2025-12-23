"use client";

import { Building2, Send, FileBarChart, Settings } from "lucide-react";
import Link from "next/link";

import { Button, Card } from "@/components/ui";

const actions = [
  {
    label: "Add Company",
    icon: Building2,
    href: "/admin/companies/new",
    color: "primary" as const,
  },
  {
    label: "Send Announcement",
    icon: Send,
    href: "/admin/announcements/new",
    color: "secondary" as const,
  },
  {
    label: "Generate Report",
    icon: FileBarChart,
    href: "/admin/reports",
    color: "default" as const,
  },
  {
    label: "System Settings",
    icon: Settings,
    href: "/admin/settings",
    color: "default" as const,
  },
];

export function QuickActions() {
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="font-semibold">Quick Actions</h3>
        <p className="text-sm text-default-500">Common tasks</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            as={Link}
            href={action.href}
            variant="bordered"
            className="justify-start h-auto py-3"
            leftIcon={action.icon}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
