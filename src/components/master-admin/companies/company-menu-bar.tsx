"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  Building2,
  ChevronDown,
  CreditCard,
  Database,
  MessageSquare,
  Paintbrush,
  Pencil,
  PlayCircle,
  Plug,
  Plus,
  Receipt,
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
import type { CompanyChatbotItem } from "@/app/api/master-admin/companies/[companyId]/chatbots/route";
import type { AgentListItem } from "@/lib/db/schema/chatbots";

interface CompanyMenuBarProps {
  companyId: string;
  chatbots: CompanyChatbotItem[];
  companyName: string;
  className?: string;
}

interface MenuItem {
  key: string;
  label: string;
  href?: string;
  icon?: LucideIcon;
  isChatbot?: boolean;
  badge?: ReactNode;
  items?: SubMenuItem[];
}

interface SubMenuItem {
  key: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  items?: SubMenuItem[];
}

function buildMenuItems(companyId: string, chatbots: CompanyChatbotItem[]): MenuItem[] {
  const basePath = `/admin/companies/${companyId}`;

  // Build chatbot menu items
  const chatbotItems: MenuItem[] = chatbots.map((chatbot) => {
    const chatbotPath = `${basePath}/chatbots/${chatbot.id}`;
    const agents = (chatbot.agentsList ?? []) as AgentListItem[];

    // Build agent sub-items for nested menu
    const agentSubItems: SubMenuItem[] = agents.map((agent) => ({
      key: agent.agent_identifier,
      label: agent.name,
      href: `${chatbotPath}/agents/${agent.agent_identifier}`,
      icon: Bot,
      badge:
        agent.agent_type === "supervisor" ? (
          <Badge variant="info" size="sm">
            sup
          </Badge>
        ) : undefined,
    }));

    return {
      key: chatbot.id,
      label: chatbot.name,
      isChatbot: true,
      items: [
        { key: "general", label: "General", href: `${chatbotPath}/general`, icon: Settings },
        // Agents with nested submenu (only if agents exist)
        ...(agentSubItems.length > 0
          ? [
              {
                key: "agents",
                label: "Agents",
                href: `${chatbotPath}/agents`,
                icon: Users,
                items: agentSubItems,
              },
            ]
          : []),
        { key: "escalation", label: "Escalation", href: `${chatbotPath}/escalation`, icon: AlertTriangle },
        { key: "integration", label: "Integration", href: `${chatbotPath}/integration`, icon: Plug },
        { key: "widget", label: "Widget Customization", href: `${chatbotPath}/widget`, icon: Paintbrush },
        { key: "test", label: "Test", href: `${chatbotPath}/test`, icon: PlayCircle },
      ],
    };
  });

  return [
    // Overview - direct link
    { key: "overview", label: "Overview", href: `${basePath}/overview`, icon: BarChart3 },

    // Company dropdown
    {
      key: "company",
      label: "Company",
      icon: Building2,
      items: [
        { key: "edit", label: "Edit Company", href: `${basePath}/edit`, icon: Pencil },
        { key: "team", label: "Team", href: `${basePath}/team`, icon: Users },
        { key: "subscription", label: "Subscription", href: `${basePath}/subscription`, icon: CreditCard },
        { key: "billing", label: "Billing", href: `${basePath}/billing`, icon: Receipt },
        { key: "settings", label: "Settings", href: `${basePath}/settings`, icon: Settings },
      ],
    },

    // Chatbot dropdown
    {
      key: "chatbot",
      label: "Chatbot",
      icon: Bot,
      items: [
        { key: "new", label: "Create New", href: `${basePath}/chatbots/new`, icon: Plus },
        { key: "knowledge", label: "Knowledge Base", href: `${basePath}/knowledge`, icon: Database },
        { key: "conversations", label: "Conversations", href: `${basePath}/conversations`, icon: MessageSquare },
      ],
    },

    // Dynamic chatbot items
    ...chatbotItems,
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
      pathname.startsWith(`${sub.href}/`) ||
      sub.items?.some((nested) => pathname === nested.href || pathname.startsWith(`${nested.href}/`))
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors outline-none",
          isActive
            ? "bg-primary/10 text-primary"
            : item.isChatbot
              ? "text-secondary hover:text-secondary hover:bg-secondary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        {Icon && <Icon size={16} />}
        <span className={cn(item.isChatbot && "font-semibold")}>{item.label}</span>
        {item.badge && <span className="ml-1">{item.badge}</span>}
        <ChevronDown size={14} className="ml-1 opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6}>
        {item.items?.map((subItem) =>
          subItem.items && subItem.items.length > 0 ? (
            // Nested submenu (Agents)
            <DropdownMenuSub key={subItem.key}>
              <DropdownMenuSubTrigger className={cn(pathname.startsWith(subItem.href) && "bg-accent")}>
                {subItem.icon && <subItem.icon size={14} className="mr-2" />}
                <span>{subItem.label}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {subItem.items.map((nested) => (
                  <DropdownMenuItem key={nested.key} asChild>
                    <Link
                      href={nested.href}
                      className={cn("flex items-center", pathname === nested.href && "bg-accent")}
                    >
                      {nested.icon && <nested.icon size={14} className="mr-2" />}
                      <span className="flex-1">{nested.label}</span>
                      {nested.badge}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <DropdownMenuItem key={subItem.key} asChild>
              <Link href={subItem.href} className={cn("flex items-center", pathname === subItem.href && "bg-accent")}>
                {subItem.icon && <subItem.icon size={14} className="mr-2" />}
                <span className="flex-1">{subItem.label}</span>
                {subItem.badge}
              </Link>
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CompanyMenuBar({ companyId, chatbots, companyName, className }: CompanyMenuBarProps) {
  const pathname = usePathname();
  const menuItems = buildMenuItems(companyId, chatbots);

  return (
    <nav
      className={cn(
        "flex items-center gap-1 px-2 py-2 bg-muted/30 border border-border/40 rounded-lg mb-4 overflow-x-auto md:overflow-visible",
        className
      )}
    >
      {menuItems.map((item) =>
        item.href && !item.items ? (
          <MenuBarLink key={item.key} item={item} isActive={pathname === item.href} />
        ) : (
          <MenuBarDropdown key={item.key} item={item} pathname={pathname} />
        )
      )}
      <span className="ml-auto text-sm text-muted-foreground">{companyName}</span>
    </nav>
  );
}
