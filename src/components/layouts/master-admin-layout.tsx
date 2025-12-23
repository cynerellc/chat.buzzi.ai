"use client";

import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  BarChart3,
  FileText,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

import { MainLayout } from "./main-layout";
import { type SidebarSection } from "./sidebar";

// Navigation configuration for master admin
const masterAdminSections: SidebarSection[] = [
  {
    key: "main",
    items: [
      { key: "dashboard", label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { key: "companies", label: "Companies", href: "/admin/companies", icon: Building2 },
    ],
  },
  {
    key: "management",
    title: "Management",
    items: [
      { key: "plans", label: "Subscription Plans", href: "/admin/plans", icon: CreditCard },
      { key: "packages", label: "Agent Packages", href: "/admin/packages", icon: Package },
    ],
  },
  {
    key: "analytics",
    title: "Analytics & Logs",
    items: [
      { key: "analytics", label: "Platform Analytics", href: "/admin/analytics", icon: BarChart3 },
      { key: "audit", label: "Audit Logs", href: "/admin/audit", icon: FileText },
    ],
  },
  {
    key: "settings",
    title: "Settings",
    items: [
      { key: "settings", label: "System Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

// Logo component
function MasterAdminLogo() {
  return (
    <Link href="/admin/dashboard" className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
        <span className="text-white font-bold text-sm">CB</span>
      </div>
      <span className="font-bold text-lg">Chat Buzzi</span>
    </Link>
  );
}

function MasterAdminLogoCollapsed() {
  return (
    <Link href="/admin/dashboard">
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
        <span className="text-white font-bold text-sm">CB</span>
      </div>
    </Link>
  );
}

export interface MasterAdminLayoutProps {
  children: ReactNode;
}

export function MasterAdminLayout({ children }: MasterAdminLayoutProps) {
  return (
    <MainLayout
      sidebarProps={{
        logo: <MasterAdminLogo />,
        logoCollapsed: <MasterAdminLogoCollapsed />,
        sections: masterAdminSections,
      }}
      headerProps={{
        title: "Master Admin",
      }}
    >
      {children}
    </MainLayout>
  );
}
