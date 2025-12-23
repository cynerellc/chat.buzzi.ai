"use client";

import {
  LayoutDashboard,
  Bot,
  Database,
  MessageSquare,
  Palette,
  Plug,
  Settings,
  CreditCard,
  Users,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

import { MainLayout } from "./main-layout";
import { type SidebarSection } from "./sidebar";

// Navigation configuration for company admin
const companyAdminSections: SidebarSection[] = [
  {
    key: "main",
    title: "Main",
    items: [
      { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { key: "agents", label: "Agents", href: "/agents", icon: Bot },
      { key: "knowledge", label: "Knowledge Base", href: "/knowledge", icon: Database },
      { key: "conversations", label: "Conversations", href: "/conversations", icon: MessageSquare },
    ],
  },
  {
    key: "configure",
    title: "Configure",
    items: [
      { key: "widget", label: "Widget", href: "/widget", icon: Palette },
      { key: "integrations", label: "Integrations", href: "/integrations", icon: Plug },
      { key: "settings", label: "Settings", href: "/settings", icon: Settings },
      { key: "billing", label: "Billing", href: "/billing", icon: CreditCard },
    ],
  },
  {
    key: "team",
    title: "Team",
    items: [
      { key: "team", label: "Team Management", href: "/team", icon: Users },
    ],
  },
];

// Logo component
function CompanyLogo({ companyName }: { companyName?: string }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
        <span className="text-white font-bold text-sm">
          {companyName?.charAt(0).toUpperCase() ?? "C"}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="font-bold text-sm leading-tight">
          {companyName ?? "Company"}
        </span>
        <span className="text-xs text-default-500 leading-tight">Dashboard</span>
      </div>
    </Link>
  );
}

function CompanyLogoCollapsed({ companyName }: { companyName?: string }) {
  return (
    <Link href="/dashboard">
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
        <span className="text-white font-bold text-sm">
          {companyName?.charAt(0).toUpperCase() ?? "C"}
        </span>
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
        logoCollapsed: <CompanyLogoCollapsed companyName={companyName} />,
        sections: companyAdminSections,
      }}
      headerProps={{
        title: companyName,
        subtitle: "Company Admin",
      }}
    >
      {children}
    </MainLayout>
  );
}
