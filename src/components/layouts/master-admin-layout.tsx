"use client";

import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  BarChart3,
  FileText,
  Settings,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

import { MainLayout } from "./main-layout";
import { type SidebarSection } from "./sidebar";

// Navigation configuration for master admin
const masterAdminSections: SidebarSection[] = [
  {
    key: "main",
    title: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { key: "companies", label: "Companies", href: "/admin/companies", icon: Building2 },
    ],
  },
  {
    key: "management",
    title: "Platform",
    items: [
      { key: "plans", label: "Subscription Plans", href: "/admin/plans", icon: CreditCard },
      { key: "packages", label: "Chatbot Packages", href: "/admin/packages", icon: Package },
    ],
  },
  {
    key: "analytics",
    title: "Monitoring",
    items: [
      { key: "analytics", label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { key: "audit", label: "Audit Logs", href: "/admin/audit", icon: FileText },
    ],
  },
  {
    key: "settings",
    title: "System",
    items: [
      { key: "settings", label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

// Logo component - Master Admin style
function MasterAdminLogo() {
  return (
    <Link href="/admin/dashboard" className="flex items-center gap-3 group">
      {/* Logo mark */}
      <div className="relative">
        <div className="w-9 h-9 rounded bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center shadow-lg shadow-destructive/20">
          <Shield size={16} className="text-destructive-foreground/90" strokeWidth={1.5} />
        </div>
        {/* Subtle glow effect */}
        <div className="absolute inset-0 rounded bg-destructive/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Text */}
      <div className="flex flex-col min-w-0">
        <span className="font-semibold text-sm text-foreground truncate leading-tight">
          Chat Buzzi
        </span>
        <span className="text-[10px] text-destructive/70 uppercase tracking-[0.15em] font-medium">
          Master Admin
        </span>
      </div>
    </Link>
  );
}

function MasterAdminLogoCollapsed() {
  return (
    <Link href="/admin/dashboard" className="group">
      <div className="relative">
        <div className="w-9 h-9 rounded bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center shadow-lg shadow-destructive/20">
          <Shield size={16} className="text-destructive-foreground/90" strokeWidth={1.5} />
        </div>
        {/* Subtle glow effect */}
        <div className="absolute inset-0 rounded bg-destructive/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
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
    >
      {children}
    </MainLayout>
  );
}
