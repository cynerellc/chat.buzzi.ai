"use client";

import { useState, type ReactNode } from "react";

import { PageProvider, usePageTitle } from "@/contexts/page-context";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

import { Header, type HeaderProps } from "./header";
import { MobileSidebar, Sidebar, useSidebar, type SidebarProps } from "./sidebar";

export interface MainLayoutProps {
  children: ReactNode;
  sidebarProps: SidebarProps;
  className?: string;
}

export function MainLayout({
  children,
  sidebarProps,
  className,
}: MainLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <PageProvider>
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar */}
        {!isMobile && <Sidebar {...sidebarProps} />}

        {/* Mobile sidebar */}
        {isMobile && (
          <MobileSidebar
            {...sidebarProps}
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Main content area */}
        <MainContent
          onMenuClick={() => setIsMobileMenuOpen(true)}
          className={className}
        >
          {children}
        </MainContent>
      </div>
    </PageProvider>
  );
}

// Content wrapper that responds to sidebar state
interface MainContentProps {
  children: ReactNode;
  onMenuClick?: () => void;
  className?: string;
}

function MainContent({ children, onMenuClick, className }: MainContentProps) {
  const { pageTitle } = usePageTitle();

  // Get sidebar state if available
  let isCollapsed = false;
  try {
    const sidebarContext = useSidebar();
    isCollapsed = sidebarContext.isCollapsed;
  } catch {
    // Sidebar context not available, use default
  }

  return (
    <div
      className={cn(
        "transition-all duration-200 min-h-screen flex flex-col",
        // Adjust margin based on sidebar state (desktop only)
        "lg:ml-64",
        isCollapsed && "lg:ml-[72px]"
      )}
    >
      <Header pageTitle={pageTitle} onMenuClick={onMenuClick} />

      {/* Content area with subtle grid pattern */}
      <div className="relative flex-1">
        {/* Subtle grid background */}
        <div className="absolute inset-0 content-grid-pattern opacity-30 pointer-events-none" />

        {/* Corner accents for content area */}
        <div className="absolute top-4 left-4 w-3 h-3 pointer-events-none hidden lg:block">
          <div className="absolute top-0 left-0 w-2 h-[1px] bg-border/40" />
          <div className="absolute top-0 left-0 w-[1px] h-2 bg-border/40" />
        </div>
        <div className="absolute top-4 right-4 w-3 h-3 pointer-events-none hidden lg:block">
          <div className="absolute top-0 right-0 w-2 h-[1px] bg-border/40" />
          <div className="absolute top-0 right-0 w-[1px] h-2 bg-border/40" />
        </div>

        {/* Main content */}
        <main className={cn("relative p-4 lg:p-6", className)}>{children}</main>
      </div>
    </div>
  );
}

// Simple page wrapper without sidebar
export interface SimpleLayoutProps {
  children: ReactNode;
  className?: string;
}

export function SimpleLayout({ children, className }: SimpleLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <main className={cn("p-4 lg:p-6", className)}>{children}</main>
    </div>
  );
}
