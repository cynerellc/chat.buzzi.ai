"use client";

import { useState, type ReactNode } from "react";

import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

import { Header, type HeaderProps } from "./header";
import { MobileSidebar, Sidebar, useSidebar, type SidebarProps } from "./sidebar";

export interface MainLayoutProps {
  children: ReactNode;
  sidebarProps: SidebarProps;
  headerProps?: Omit<HeaderProps, "onMenuClick">;
  className?: string;
}

export function MainLayout({
  children,
  sidebarProps,
  headerProps,
  className,
}: MainLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
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
        headerProps={{
          ...headerProps,
          onMenuClick: () => setIsMobileMenuOpen(true),
        }}
        className={className}
      >
        {children}
      </MainContent>
    </div>
  );
}

// Content wrapper that responds to sidebar state
interface MainContentProps {
  children: ReactNode;
  headerProps?: HeaderProps;
  className?: string;
}

function MainContent({ children, headerProps, className }: MainContentProps) {
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
        "transition-all duration-200",
        // Adjust margin based on sidebar state (desktop only)
        "lg:ml-64",
        isCollapsed && "lg:ml-[72px]"
      )}
    >
      {headerProps && <Header {...headerProps} />}
      <main className={cn("p-4 lg:p-6", className)}>{children}</main>
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
