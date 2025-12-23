"use client";

import { Plus, BookOpen, Palette, UserPlus } from "lucide-react";
import Link from "next/link";

import { Button, Card } from "@/components/ui";

interface QuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
  color: "primary" | "secondary" | "success" | "warning";
}

const actions: QuickAction[] = [
  {
    label: "Create Agent",
    href: "/agents/new",
    icon: Plus,
    color: "primary",
  },
  {
    label: "Add Knowledge",
    href: "/knowledge",
    icon: BookOpen,
    color: "secondary",
  },
  {
    label: "Customize Widget",
    href: "/settings/widget",
    icon: Palette,
    color: "success",
  },
  {
    label: "Invite Team",
    href: "/settings/team",
    icon: UserPlus,
    color: "warning",
  },
];

export function QuickActions() {
  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Quick Actions</h3>
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.label}
              as={Link}
              href={action.href}
              variant="flat"
              color={action.color}
              startContent={<Icon size={16} />}
            >
              {action.label}
            </Button>
          );
        })}
      </div>
    </Card>
  );
}
