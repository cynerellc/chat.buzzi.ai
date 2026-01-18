"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ChevronDown,
  Paintbrush,
  Plug,
  Settings,
  AlertTriangle,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ChatbotAgentConfig } from "@/hooks/company";

interface ChatbotMenuBarProps {
  chatbotId: string;
  chatbotName: string;
  agents: ChatbotAgentConfig[];
  className?: string;
}

interface MenuItem {
  key: string;
  label: string;
  href?: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  items?: SubMenuItem[];
}

interface SubMenuItem {
  key: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: ReactNode;
}

function buildMenuItems(chatbotId: string, agents: ChatbotAgentConfig[]): MenuItem[] {
  const basePath = `/chatbots/${chatbotId}`;

  // Build agent sub-items for nested menu
  const agentSubItems: SubMenuItem[] = agents.map((agent) => ({
    key: agent.agent_identifier,
    label: agent.name,
    href: `${basePath}/agents/${agent.agent_identifier}`,
    icon: Bot,
    badge:
      agent.agent_type === "supervisor" ? (
        <Badge variant="info" size="sm">
          sup
        </Badge>
      ) : undefined,
  }));

  return [
    // General - direct link
    { key: "general", label: "General", href: `${basePath}/general`, icon: Settings },

    // Agents dropdown (only if agents exist)
    ...(agentSubItems.length > 0
      ? [
          {
            key: "agents",
            label: "Agents",
            icon: Users,
            items: agentSubItems,
          },
        ]
      : []),

    // Escalation - direct link
    { key: "escalation", label: "Escalation", href: `${basePath}/escalation`, icon: AlertTriangle },

    // Integrations - direct link
    { key: "integrations", label: "Integrations", href: `${basePath}/integration`, icon: Plug },

    // Widget - direct link
    { key: "widget", label: "Widget", href: `${basePath}/widget`, icon: Paintbrush },
  ];
}

function MenuBarLink({
  item,
  isActive,
}: {
  item: MenuItem;
  isActive: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href!}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      {Icon && <Icon size={16} />}
      <span>{item.label}</span>
    </Link>
  );
}

function MenuBarDropdown({
  item,
  pathname,
}: {
  item: MenuItem;
  pathname: string;
}) {
  const Icon = item.icon;

  // Check if any child item is active
  const isActive = item.items?.some(
    (sub) =>
      pathname === sub.href ||
      pathname.startsWith(`${sub.href}/`)
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors outline-none",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        {Icon && <Icon size={16} />}
        <span>{item.label}</span>
        {item.badge && <span className="ml-1">{item.badge}</span>}
        <ChevronDown size={14} className="ml-1 opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6}>
        {item.items?.map((subItem) => (
          <DropdownMenuItem key={subItem.key} asChild>
            <Link href={subItem.href} className={cn("flex items-center", pathname === subItem.href && "bg-accent")}>
              {subItem.icon && <subItem.icon size={14} className="mr-2" />}
              <span className="flex-1">{subItem.label}</span>
              {subItem.badge}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ChatbotMenuBar({ chatbotId, chatbotName, agents, className }: ChatbotMenuBarProps) {
  const pathname = usePathname();
  const menuItems = buildMenuItems(chatbotId, agents);

  return (
    <nav
      className={cn(
        "card-extended-corners flex items-center gap-1 px-2 py-2 bg-muted/30 border border-border/40 mb-4 overflow-x-auto md:overflow-visible",
        className
      )}
    >
      <span className="corner-extensions" />
      {menuItems.map((item) =>
        item.href && !item.items ? (
          <MenuBarLink key={item.key} item={item} isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)} />
        ) : (
          <MenuBarDropdown key={item.key} item={item} pathname={pathname} />
        )
      )}
      <span className="ml-auto text-sm text-muted-foreground font-medium">{chatbotName}</span>
    </nav>
  );
}
