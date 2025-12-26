"use client";

import { type ReactNode } from "react";

import { AuthProvider } from "@/lib/auth/provider";
import { Toaster } from "@/components/ui/toast";

import { ThemeProvider } from "./theme-provider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}

export { ThemeProvider } from "./theme-provider";
