"use client";

import { HeroUIProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { AuthProvider } from "@/lib/auth/provider";

import { ThemeProvider } from "./theme-provider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const router = useRouter();

  return (
    <ThemeProvider>
      <AuthProvider>
        <HeroUIProvider navigate={router.push}>
          {children}
        </HeroUIProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export { ThemeProvider } from "./theme-provider";
