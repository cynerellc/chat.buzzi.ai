"use client";

import {
  LayoutDashboard,
  Bot,
  Database,
  MessageSquare,
  Settings,
  CreditCard,
  Users,
  Hexagon,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

import { MainLayout } from "./main-layout";
import { type SidebarSection } from "./sidebar";

// Navigation configuration for company admin
const companyAdminSections: SidebarSection[] = [
  {
    key: "main",
    title: "Operations",
    items: [
      { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { key: "chatbots", label: "Chatbots", href: "/chatbots", icon: Bot },
      { key: "knowledge", label: "Knowledge Base", href: "/knowledge", icon: Database },
      { key: "conversations", label: "Conversations", href: "/conversations", icon: MessageSquare },
    ],
  },
  {
    key: "configure",
    title: "Configuration",
    items: [
      { key: "settings", label: "Settings", href: "/settings", icon: Settings },
      { key: "billing", label: "Billing", href: "/billing", icon: CreditCard },
    ],
  },
  {
    key: "team",
    title: "Organization",
    items: [
      { key: "team", label: "Team", href: "/team", icon: Users },
    ],
  },
];

// Logo component - Enterprise style
function CompanyLogo({ companyName }: { companyName?: string }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 group">
      {/* Logo mark */}
      <div className="relative">
        <div className="w-9 h-9 rounded bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <Hexagon size={16} className="text-primary-foreground/90" strokeWidth={1.5} />
        </div>
        {/* Subtle glow effect */}
        <div className="absolute inset-0 rounded bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Text */}
      <div className="flex flex-col min-w-0">
        <span className="font-semibold text-sm text-foreground truncate leading-tight">
          {companyName ?? "Company"}
        </span>
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-medium">
          Control Panel
        </span>
      </div>
    </Link>
  );
}

function CompanyLogoCollapsed() {
  return (
    <Link href="/dashboard" className="group">
      <div className="relative">
        <div className="w-9 h-9 rounded bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <Hexagon size={16} className="text-primary-foreground/90" strokeWidth={1.5} />
        </div>
        {/* Subtle glow effect */}
        <div className="absolute inset-0 rounded bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

export interface CompanyAdminLayoutProps {
  children: ReactNode;
  companyName?: string;
}

export function CompanyAdminLayout({ children, companyName }: CompanyAdminLayoutProps) {
  return (
    <MainLayout
      sidebarProps={{
        logo: <CompanyLogo companyName={companyName} />,
        logoCollapsed: <CompanyLogoCollapsed />,
        sections: companyAdminSections,
      }}
    >
      {children}
    </MainLayout>
  );
}
