"use client";

import {
  Inbox,
  InboxIcon,
  Star,
  CheckCircle,
  MessageSquare,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

import { MainLayout } from "./main-layout";
import { type SidebarSection } from "./sidebar";

// Navigation configuration for support agent
const supportAgentSections: SidebarSection[] = [
  {
    key: "inbox",
    title: "Inbox",
    items: [
      { key: "my-inbox", label: "My Inbox", href: "/inbox", icon: Inbox, badge: 5 },
      { key: "unassigned", label: "Unassigned", href: "/inbox/unassigned", icon: InboxIcon, badge: 12 },
    ],
  },
  {
    key: "quick-access",
    title: "Quick Access",
    items: [
      { key: "starred", label: "Starred", href: "/inbox/starred", icon: Star },
      { key: "resolved", label: "All Resolved", href: "/inbox/resolved", icon: CheckCircle },
    ],
  },
  {
    key: "tools",
    title: "Tools",
    items: [
      { key: "responses", label: "Canned Responses", href: "/responses", icon: MessageSquare },
      { key: "settings", label: "My Settings", href: "/agent-settings", icon: Settings },
    ],
  },
];

// Logo component
function AgentLogo({ companyName }: { companyName?: string }) {
  return (
    <Link href="/inbox" className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-success flex items-center justify-center">
        <Inbox size={18} className="text-white" />
      </div>
      <div className="flex flex-col">
        <span className="font-bold text-sm leading-tight">Support</span>
        <span className="text-xs text-default-500 leading-tight">
          {companyName ?? "Agent Portal"}
        </span>
      </div>
    </Link>
  );
}

function AgentLogoCollapsed() {
  return (
    <Link href="/inbox">
      <div className="w-8 h-8 rounded-lg bg-success flex items-center justify-center">
        <Inbox size={18} className="text-white" />
      </div>
    </Link>
  );
}

// Agent status selector component
function AgentStatusSelector() {
  // TODO: Implement status selector dropdown
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-success/10 text-success text-sm">
      <div className="w-2 h-2 rounded-full bg-success" />
      <span>Online</span>
    </div>
  );
}

export interface SupportAgentLayoutProps {
  children: ReactNode;
  companyName?: string;
}

export function SupportAgentLayout({ children, companyName }: SupportAgentLayoutProps) {
  return (
    <MainLayout
      sidebarProps={{
        logo: <AgentLogo companyName={companyName} />,
        logoCollapsed: <AgentLogoCollapsed />,
        sections: supportAgentSections,
        footer: <AgentStatusSelector />,
      }}
      headerProps={{
        title: "Support Inbox",
      }}
    >
      {children}
    </MainLayout>
  );
}
